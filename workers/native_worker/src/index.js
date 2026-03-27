import { handleAdd } from './handlers/add.js';
import { handleRemove } from './handlers/remove.js';
import { handleExtRemove } from './handlers/extRemove.js';
import { handleList } from './handlers/list.js';
import { handleMerge } from './handlers/merge.js';
import { handleProducts } from './handlers/products.js';

/**
 * Match wishlist API paths whether they arrive via direct URL or
 * through the Shopify App Proxy (which prepends a prefix).
 */
function matchesWishlistPath(pathname, suffix) {
  return pathname === suffix || pathname.endsWith(suffix);
}

/** Shared CORS preflight response. */
function corsPreflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      // Authorization is required for the session-token auth path used by
      // Customer Account extensions that call the Worker directly.
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {ExecutionContext} _ctx
   */
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return corsPreflightResponse();

    // ── Health check ──
    if ((path === '/health' || matchesWishlistPath(path, '/wishlist/health')) && method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'native_worker' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Root ──
    if (path === '/' && method === 'GET') {
      return new Response(
        '<html><head><title>Rocky Wishlist</title></head><body>' +
          '<p>Rocky wishlist worker is running.</p>' +
          '</body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // ── Wishlist API routes ──
    if (matchesWishlistPath(path, '/wishlist/add') && method === 'POST') return handleAdd(request, env);
    if (matchesWishlistPath(path, '/wishlist/remove') && method === 'POST') return handleRemove(request, env);
    // Extension-direct remove: called by Customer Account UI extensions using a
    // session token (Authorization: Bearer <JWT>). Bypasses App Proxy — which
    // cannot forward cross-origin requests from extensions.shopifycdn.com.
    if (path === '/wishlist/ext/remove' && method === 'POST') return handleExtRemove(request, env);
    if (matchesWishlistPath(path, '/wishlist/list') && method === 'GET') return handleList(request, env);
    if (matchesWishlistPath(path, '/wishlist/merge') && method === 'POST') return handleMerge(request, env);
    if (matchesWishlistPath(path, '/wishlist/products') && method === 'GET') return handleProducts(request, env);

    return new Response('Not Found', { status: 404 });
  },
};
