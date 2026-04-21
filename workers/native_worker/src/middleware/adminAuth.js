/**
 * Admin route authentication.
 *
 * Admin pages are loaded inside the Shopify admin iframe and authenticate via
 * App Bridge ID tokens (`shopify.idToken()`). The token is an HS256 JWT signed
 * with the app's client secret and carries a `dest` claim identifying the shop.
 *
 * This middleware:
 *   1. Reads the Bearer token from the Authorization header
 *   2. Verifies the signature + expiry
 *   3. Confirms `dest` matches the shop this Worker serves (env.SHOP_DOMAIN)
 *   4. Passes shop + staff user ID to the handler
 *
 * Non-200 responses are plain JSON (the admin page fetches these via `fetch`).
 */

import { verifyAdminToken } from '../shopify/sessionToken.js';
import { jsonResponse } from '../utils/response.js';

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {(ctx: { request: Request; env: Record<string, unknown>; shop: string; userId: string | null }) => Promise<Response>} handler
 */
export async function withAdminAuth(request, env, handler) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return jsonResponse({ ok: false, reason: 'unauthorized' }, 401, request, env);
  }

  const secret = String(env.SHOPIFY_CLIENT_SECRET ?? env.SHOPIFY_PROXY_SECRET ?? '');
  if (!secret) {
    console.error('[adminAuth] SHOPIFY_CLIENT_SECRET not configured');
    return jsonResponse({ ok: false, reason: 'server_misconfigured' }, 500, request, env);
  }

  const expectedShop = String(env.SHOP_DOMAIN ?? env.SHOP_MYSHOPIFY_DOMAIN ?? '').toLowerCase();

  let shop, userId;
  try {
    ({ shop, userId } = await verifyAdminToken(token, secret, expectedShop || undefined));
  } catch (e) {
    console.error('[adminAuth] token validation failed:', e?.message);
    return jsonResponse({ ok: false, reason: 'unauthorized' }, 401, request, env);
  }

  try {
    return await handler({ request, env, shop, userId });
  } catch (e) {
    console.error('[adminAuth] handler error:', e?.message ?? e, e?.stack ?? '');
    return jsonResponse({ ok: false, reason: 'server_error' }, 500, request, env);
  }
}
