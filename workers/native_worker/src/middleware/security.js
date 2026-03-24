import { verifyShopifyHmac } from './hmac.js';
import { validateCustomerId } from './validate.js';
import { AuthError, ValidationError, RateLimitError } from '../utils/errors.js';
import { errorResponse } from '../utils/response.js';

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {(ctx: { request: Request; env: Record<string, unknown>; customerId: string | null; shop: string | null }) => Promise<Response>} handler
 * @param {{ requireAuth?: boolean }} [options]
 */
export async function withSecurity(request, env, handler, { requireAuth = true } = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  if (env.IP_RATE_LIMITER && typeof env.IP_RATE_LIMITER.limit === 'function') {
    const ipCheck = await env.IP_RATE_LIMITER.limit({ key: clientIP });
    if (!ipCheck.success) {
      return errorResponse('rate_limited', 429, request, env);
    }
  }

  const maxAge = parseInt(String(env.HMAC_MAX_AGE_SECONDS ?? '300'), 10);
  const valid = await verifyShopifyHmac(request.url, env.SHOPIFY_PROXY_SECRET, maxAge);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const timestamp = url.searchParams.get('timestamp');
  const sig = url.searchParams.get('signature');
  if (env.NONCE_KV && timestamp && sig) {
    const nonce = `${timestamp}-${sig.substring(0, 16)}`;
    try {
      const seen = await env.NONCE_KV.get(nonce);
      if (seen) return new Response('Unauthorized', { status: 401 });
      await env.NONCE_KV.put(nonce, '1', { expirationTtl: maxAge });
    } catch (e) {
      console.error('Nonce KV error:', e?.message ?? e);
    }
  }

  const customerId = url.searchParams.get('logged_in_customer_id');
  const shop = url.searchParams.get('shop');

  if (env.WISHLIST_RATE_LIMITER && typeof env.WISHLIST_RATE_LIMITER.limit === 'function') {
    const rateLimitKey = customerId ?? `anon:${clientIP}`;
    const custCheck = await env.WISHLIST_RATE_LIMITER.limit({ key: rateLimitKey });
    if (!custCheck.success) {
      return new Response(JSON.stringify({ ok: false, reason: 'rate_limited' }), {
        status: 429,
        headers: { 'Retry-After': '60', 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    if (requireAuth) validateCustomerId(customerId);
    return await handler({ request, env, customerId, shop });
  } catch (e) {
    if (e instanceof AuthError) return new Response('Forbidden', { status: 403 });
    if (e instanceof ValidationError) return errorResponse(e.message, 422, request, env);
    if (e instanceof RateLimitError) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(e.retryAfter) },
      });
    }
    console.error('Unhandled worker error:', e);
    return errorResponse('server_error', 500, request, env);
  }
}
