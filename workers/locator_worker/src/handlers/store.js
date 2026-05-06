import { fetchStoreLocation } from '../shopify/adminApi.js';
import { validateHandle } from '../middleware/validate.js';
import { jsonResponse } from '../utils/response.js';

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} rawHandle
 */
export async function handleStore(request, env, rawHandle) {
  const handle = validateHandle(rawHandle);
  const store = await fetchStoreLocation(env, env.SHOP_DOMAIN, handle);

  const ttl = Number(env.STORES_CACHE_SECONDS ?? 3600);

  return jsonResponse({ ok: true, store }, 200, request, env, {
    cacheControl: `public, s-maxage=${ttl}, stale-while-revalidate=43200, stale-if-error=86400`,
  });
}
