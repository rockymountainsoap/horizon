import { fetchStoreLocations } from '../shopify/adminApi.js';
import { ALLOWED_LOCATION_TYPES } from '../config.js';
import { ValidationError } from '../utils/errors.js';
import { jsonResponse } from '../utils/response.js';

/**
 * GET /stores                       → all 80 store_location metaobjects (unfiltered)
 * GET /stores?location_type=rocky_store → server-side filter, only matching entries
 *
 * The query parameter is allow-listed (see ALLOWED_LOCATION_TYPES) — anything
 * else returns 422. Different URLs cache separately at the edge, so the
 * dedicated locator page and the PDP find-in-store keep independent caches.
 */
export async function handleStores(request, env) {
  const url = new URL(request.url);
  const locationType = url.searchParams.get('location_type');

  if (locationType && !ALLOWED_LOCATION_TYPES.has(locationType)) {
    throw new ValidationError(`Unknown location_type '${locationType}'`);
  }

  const stores = await fetchStoreLocations(env, env.SHOP_DOMAIN, {
    locationType: locationType || null,
  });

  const ttl = Number(env.STORES_CACHE_SECONDS ?? 3600);

  return jsonResponse({ ok: true, stores }, 200, request, env, {
    cacheControl: `public, s-maxage=${ttl}, stale-while-revalidate=43200, stale-if-error=86400`,
  });
}
