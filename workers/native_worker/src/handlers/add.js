import { withSecurity } from '../middleware/security.js';
import { validateProductGid, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';
import { syncWishlistChange } from '../klaviyo/sync.js';

export function handleAdd(request, env, ctx) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const adminToken = await getAdminToken(env, shop);

    const body = await parseBody(request);
    const productGid = validateProductGid(body.productGid);
    const maxSize = parseInt(String(env.MAX_WISHLIST_SIZE ?? '250'), 10);

    const { list, email } = await getWishlist(customerId, shop, adminToken);

    if (list.includes(productGid)) {
      return jsonResponse({ ok: true, list, alreadySaved: true }, 200, request, env);
    }

    if (list.length >= maxSize) {
      return jsonResponse({ ok: false, reason: 'wishlist_full', limit: maxSize }, 422, request, env);
    }

    list.push(productGid);
    await setWishlist(customerId, list, shop, adminToken);

    if (email && env.KLAVIYO_PRIVATE_KEY) {
      ctx.waitUntil(
        syncWishlistChange(env, shop, adminToken, customerId, email, 'add', productGid, list)
      );
    }

    return jsonResponse({ ok: true, list }, 200, request, env);
  });
}
