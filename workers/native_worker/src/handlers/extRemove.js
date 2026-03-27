/**
 * Extension-originated remove handler.
 *
 * Called directly by the Customer Account UI extension (not via App Proxy)
 * because Shopify's App Proxy redirects cross-origin requests that don't carry
 * a storefront session cookie — making it unusable from extension context.
 *
 * Auth: Shopify Customer Account session token (HS256 JWT signed with client secret).
 * The extension obtains this via shopify.sessionToken.get() and sends it as
 * Authorization: Bearer <token>.
 *
 * @see https://shopify.dev/docs/api/customer-account-ui-extensions/latest/apis/session-token
 */

import { verifySessionToken } from '../shopify/sessionToken.js';
import { validateProductGid, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleExtRemove(request, env) {
  // Validate session token from Authorization header
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return jsonResponse({ ok: false, reason: 'unauthorized' }, 401, request, env);
  }

  const secret = String(env.SHOPIFY_CLIENT_SECRET ?? '');
  if (!secret) {
    console.error('[extRemove] SHOPIFY_CLIENT_SECRET not configured');
    return jsonResponse({ ok: false, reason: 'server_misconfigured' }, 500, request, env);
  }

  let customerId, shop;
  try {
    ({ customerId, shop } = await verifySessionToken(token, secret));
  } catch (e) {
    console.error('[extRemove] token validation failed:', e?.message);
    return jsonResponse({ ok: false, reason: 'unauthorized' }, 401, request, env);
  }

  try {
    const adminToken = await getAdminToken(env, shop);
    const body = await parseBody(request);
    const productGid = validateProductGid(body.productGid);

    const { list } = await getWishlist(customerId, shop, adminToken);
    const updated = list.filter((gid) => gid !== productGid);

    if (updated.length !== list.length) {
      await setWishlist(customerId, updated, shop, adminToken);
    }

    return jsonResponse({ ok: true, list: updated }, 200, request, env);
  } catch (e) {
    if (e instanceof ValidationError) {
      return jsonResponse({ ok: false, reason: e.message }, 422, request, env);
    }
    console.error('[extRemove] error:', e?.message);
    return jsonResponse({ ok: false, reason: 'server_error' }, 500, request, env);
  }
}
