import { fetchInventoryByVariant } from '../shopify/adminApi.js';
import { validateNumericId } from '../middleware/validate.js';
import { jsonResponse } from '../utils/response.js';

export async function handleInventory(request, env) {
  const url = new URL(request.url);
  const variantId = validateNumericId(url.searchParams.get('variantId'));

  const inventory = await fetchInventoryByVariant(env, env.SHOP_DOMAIN, variantId);

  const ttl = Number(env.INVENTORY_CACHE_SECONDS ?? 300);

  return jsonResponse({ ok: true, inventory }, 200, request, env, {
    cacheControl: `public, s-maxage=${ttl}, stale-while-revalidate=3600, stale-if-error=86400`,
  });
}
