/**
 * Tiny passthrough — CORS headers are applied uniformly inside
 * `utils/response.js`. Kept as a module so that future per-route policy
 * (e.g. credentialed endpoints) has a single seam to extend.
 */
export { corsHeaders, corsPreflightResponse, resolveAllowOrigin } from '../utils/response.js';
