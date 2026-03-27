/** Shopify Admin API version used for all GraphQL calls. */
export const ADMIN_API_VERSION = '2025-04';

/** Maximum number of product IDs the /products endpoint will accept. */
export const MAX_PRODUCT_IDS = 50;

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
