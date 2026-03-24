import { withSecurity } from '../middleware/security.js';
import { getWishlist } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';

export function handleList(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const { list } = await getWishlist(customerId, shop, env.SHOPIFY_ADMIN_TOKEN);
    return jsonResponse({ ok: true, list }, 200, request, env);
  });
}
