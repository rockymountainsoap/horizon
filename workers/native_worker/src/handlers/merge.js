import { withSecurity } from '../middleware/security.js';
import { validateGidArray, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';

export function handleMerge(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const adminToken = await getAdminToken(env, shop);

    const body = await parseBody(request);
    const localList = validateGidArray(body.local ?? []);
    const maxSize = parseInt(String(env.MAX_WISHLIST_SIZE ?? '250'), 10);

    const { list: serverList } = await getWishlist(customerId, shop, adminToken);

    const merged = [...new Set([...serverList, ...localList])].slice(0, maxSize);

    const unchanged =
      merged.length === serverList.length && merged.every((gid, i) => gid === serverList[i]);
    if (!unchanged) {
      await setWishlist(customerId, merged, shop, adminToken);
    }

    return jsonResponse({ ok: true, list: merged }, 200, request, env);
  });
}
