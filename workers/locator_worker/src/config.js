/** Shopify Admin API version used for all GraphQL calls. */
export const ADMIN_API_VERSION = '2025-04';

/**
 * KV key for the cached Client Credentials access token.
 * Only one token is active per Worker deployment (single-shop).
 */
export const TOKEN_CACHE_KEY = 'cc_access_token';

/**
 * How long to cache the Client Credentials token (seconds).
 * Shopify tokens expire in 86 399s (24h). We cache for 23h to
 * guarantee a fresh token is acquired well before expiry.
 */
export const TOKEN_CACHE_TTL_SECONDS = 82_800;

/** Metaobject type used for Rocky retail store locations. */
export const STORE_LOCATION_TYPE = 'store_location';

/**
 * Allow-list of `location_type` values that callers may pass via the
 * `?location_type=` query parameter on `/stores`. Anything not in this list
 * is rejected with a 422 — prevents arbitrary metaobject queries through the
 * Worker.
 */
export const ALLOWED_LOCATION_TYPES = new Set([
  'rocky_store',
  'wholesale',
  'pop_up',
]);

/** Maximum number of store_location metaobjects pulled by /stores. */
export const STORES_PAGE_SIZE = 250;

/** Maximum number of inventory_levels rows pulled per variant. */
export const INVENTORY_LEVELS_PAGE_SIZE = 50;
