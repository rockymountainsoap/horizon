import { withSecurity } from '../middleware/security.js';
import { validateProductGid, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';

export function handleRemove(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const adminToken = await getAdminToken(env, shop);

    const body = await parseBody(request);
    const productGid = validateProductGid(body.productGid);

    const { list } = await getWishlist(customerId, shop, adminToken);
    const updated = list.filter((gid) => gid !== productGid);

    if (updated.length !== list.length) {
      await setWishlist(customerId, updated, shop, adminToken);
    }

    return jsonResponse({ ok: true, list: updated }, 200, request, env);
  });
}
