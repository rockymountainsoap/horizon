import { TOKEN_CACHE_KEY, TOKEN_CACHE_TTL_SECONDS } from '../config.js';

/**
 * In-memory token cache. Survives across requests within the same Worker
 * isolate but is cleared on cold starts — KV acts as the durable L2 cache.
 * @type {{ token: string; expiresAt: number } | null}
 */
let memoryCache = null;

/**
 * Acquire a valid Admin API access token for the given shop using the
 * Shopify Client Credentials Grant (OAuth 2.0 §4.4).
 *
 * Resolution order:
 *   1. In-memory cache (same isolate, sub-ms)
 *   2. KV cache (cross-isolate, ~10ms)
 *   3. Fresh token from Shopify token endpoint (network round-trip, ~200ms)
 *
 * Tokens are valid for 24h. We cache them for TOKEN_CACHE_TTL_SECONDS
 * (default 23h) to avoid edge-case expiry during a request.
 *
 * @param {Record<string, unknown>} env
 * @param {string | null} shop  e.g. "store.myshopify.com"
 * @returns {Promise<string>}
 */
export async function getAdminToken(env, shop) {
  const host = normalizeShopHost(shop ?? env.SHOP_DOMAIN ?? '');
  if (!host) throw new Error('Cannot resolve shop hostname for token request');

  const now = Date.now();

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

  const token = await requestToken(env, host);

  memoryCache = {
    token,
    expiresAt: now + TOKEN_CACHE_TTL_SECONDS * 1000,
  };

  if (env.APP_KV && typeof env.APP_KV.put === 'function') {
    await env.APP_KV.put(TOKEN_CACHE_KEY, token, {
      expirationTtl: TOKEN_CACHE_TTL_SECONDS,
    });
  }

  return token;
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
  const clientSecret = String(env.SHOPIFY_CLIENT_SECRET ?? env.SHOPIFY_PROXY_SECRET ?? '').trim();

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
    console.error('[tokens] client_credentials exchange failed:', res.status, JSON.stringify(body));
    throw new Error(`Token exchange failed (${res.status}): ${body.error ?? 'unknown'}`);
  }

  return body.access_token;
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
