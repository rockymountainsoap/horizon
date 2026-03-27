import { withSecurity } from '../middleware/security.js';
import { getWishlist } from '../shopify/adminApi.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';

export function handleList(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const adminToken = await getAdminToken(env, shop);
    const { list } = await getWishlist(customerId, shop, adminToken);
    return jsonResponse({ ok: true, list }, 200, request, env);
  });
}
