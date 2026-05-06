import { TOKEN_CACHE_KEY, TOKEN_CACHE_TTL_SECONDS } from '../config.js';

/**
 * In-memory token cache. Survives across requests within the same Worker
 * isolate but is cleared on cold starts — KV acts as the durable L2 cache.
 * @type {{ token: string; expiresAt: number } | null}
 */
let memoryCache = null;

/** Test-only — reset the in-memory cache between vitest cases. */
export function _resetMemoryCacheForTests() {
  memoryCache = null;
}

/**
 * Acquire a valid Admin API access token for the given shop using the
 * Shopify Client Credentials Grant (OAuth 2.0 §4.4).
 *
 * Resolution order (when `forceRefresh` is false):
 *   1. In-memory cache (same isolate, sub-ms)
 *   2. KV cache (cross-isolate, ~10ms)
 *   3. Fresh token from Shopify token endpoint (network round-trip, ~200ms)
 *
 * Cache TTL honours Shopify's `expires_in` minus a 5-minute safety margin,
 * capped at TOKEN_CACHE_TTL_SECONDS. Shopify reserves the right to revoke
 * cached tokens early — callers should wrap requests with `withTokenRetry`
 * so a 401 evicts the cache and retries once with a fresh token.
 *
 * @param {Record<string, unknown>} env
 * @param {string | null} shop
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function getAdminToken(env, shop, opts = {}) {
  const host = normalizeShopHost(shop ?? env.SHOP_DOMAIN ?? '');
  if (!host) throw new Error('Cannot resolve shop hostname for token request');

  const now = Date.now();

  if (!opts.forceRefresh) {
    if (memoryCache && memoryCache.token && now < memoryCache.expiresAt) {
      return memoryCache.token;
    }

    if (env.APP_KV && typeof env.APP_KV.get === 'function') {
      const cached = await env.APP_KV.get(TOKEN_CACHE_KEY);
      if (cached) {
        memoryCache = { token: cached, expiresAt: now + 5 * 60 * 1000 };
        return cached;
      }
    }
  }

  const { token, expiresIn } = await requestToken(env, host);

  // Use Shopify's expires_in (minus 5-min safety margin), capped at our default.
  const ttlSeconds = Math.min(
    TOKEN_CACHE_TTL_SECONDS,
    Math.max(60, (expiresIn || TOKEN_CACHE_TTL_SECONDS) - 300)
  );

  memoryCache = {
    token,
    expiresAt: now + ttlSeconds * 1000,
  };

  if (env.APP_KV && typeof env.APP_KV.put === 'function') {
    await env.APP_KV.put(TOKEN_CACHE_KEY, token, {
      expirationTtl: ttlSeconds,
    });
  }

  return token;
}

/**
 * Drop the in-memory + KV token cache. Call after a 401 from Shopify so the
 * next request re-exchanges credentials.
 *
 * @param {Record<string, unknown>} env
 */
export async function evictAdminToken(env) {
  memoryCache = null;
  if (env.APP_KV && typeof env.APP_KV.delete === 'function') {
    try { await env.APP_KV.delete(TOKEN_CACHE_KEY); } catch {}
  }
}

/**
 * Exchange client credentials for a fresh Admin API access token.
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop  Normalized shop hostname
 * @returns {Promise<string>}
 */
async function requestToken(env, shop) {
  const clientId = String(env.SHOPIFY_CLIENT_ID ?? '').trim();
  const clientSecret = String(env.SHOPIFY_CLIENT_SECRET ?? '').trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET. ' +
        'Set them as Wrangler secrets: npx wrangler secret put SHOPIFY_CLIENT_SECRET'
    );
  }

  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok || !body.access_token) {
    // Surface common, actionable error codes by name so deployers see them in
    // wrangler tail without grepping the raw body.
    const code = body.error || 'unknown';
    if (code === 'shop_not_permitted') {
      console.error('[tokens] shop_not_permitted — the app and store must be in the same Shopify organisation. Verify SHOPIFY_CLIENT_ID matches the app installed on SHOP_DOMAIN.');
    }
    console.error('[tokens] client_credentials exchange failed:', res.status, JSON.stringify(body));
    throw new Error(`Token exchange failed (${res.status}): ${code}`);
  }

  // Log the granted scopes once per fresh exchange so a missing scope shows up
  // in wrangler tail before it ever causes a 401 / 200-with-errors at query time.
  const grantedScopes = String(body.scope ?? '').split(',').filter(Boolean);
  console.log(`[tokens] fresh access token issued — ${grantedScopes.length} scope(s) granted: ${grantedScopes.join(', ')}`);

  return { token: body.access_token, expiresIn: Number(body.expires_in) || 0 };
}

/**
 * Normalize a shop hostname to the canonical `store.myshopify.com` form.
 * @param {string} shop
 */
export function normalizeShopHost(shop) {
  const s = String(shop).trim().toLowerCase();
  if (!s) return '';
  const noProto = s.replace(/^https?:\/\//, '').split('/')[0];
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(noProto)) return '';
  return noProto;
}
