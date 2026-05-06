// Matches any *.shopify.com or *.shopifycdn.com origin (extensions, customer
// accounts, CDN). Origin allowlist is defense-in-depth; the Worker has no
// secrets the storefront can reach beyond what these endpoints already expose.
const SHOPIFY_ORIGIN_RE = /^https:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopify|shopifycdn)\.com$/;

/**
 * Resolve the CORS Allow-Origin to echo back to the requester.
 * Origin must be on the env-supplied ALLOWED_ORIGINS list, an env-supplied
 * shop domain, or a *.shopify.com / *.shopifycdn.com origin. Otherwise '*' is
 * returned (no credentials are involved on these endpoints).
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export function resolveAllowOrigin(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  if (!origin) return '*';

  /** @type {string[]} */
  const allowed = [];
  if (env.ALLOWED_ORIGINS) {
    for (const entry of String(env.ALLOWED_ORIGINS).split(',')) {
      const trimmed = entry.trim();
      if (trimmed) allowed.push(trimmed);
    }
  }
  if (env.SHOP_DOMAIN) allowed.push(`https://${env.SHOP_DOMAIN}`);
  if (env.SHOP_MYSHOPIFY_DOMAIN) allowed.push(`https://${env.SHOP_MYSHOPIFY_DOMAIN}`);

  if (allowed.includes(origin) || SHOPIFY_ORIGIN_RE.test(origin)) return origin;
  return '*';
}

export function corsHeaders(request, env) {
  return {
    'Access-Control-Allow-Origin': resolveAllowOrigin(request, env),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function corsPreflightResponse(request, env) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Build the headers for a JSON response.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ cacheControl?: string }} [opts]
 */
export function secureHeaders(request, env, opts = {}) {
  return {
    ...corsHeaders(request, env),
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': opts.cacheControl ?? 'no-store, no-cache, must-revalidate',
  };
}

/**
 * @param {unknown} data
 * @param {number} status
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ cacheControl?: string }} [opts]
 */
export function jsonResponse(data, status, request, env, opts = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secureHeaders(request, env, opts),
  });
}

/**
 * @param {string} reason
 * @param {number} status
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export function errorResponse(reason, status, request, env) {
  return jsonResponse({ ok: false, reason }, status, request, env);
}
