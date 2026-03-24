import { handleAdd } from './handlers/add.js';
import { handleRemove } from './handlers/remove.js';
import { handleList } from './handlers/list.js';
import { handleMerge } from './handlers/merge.js';

function matchesWishlistPath(pathname, suffix) {
  return pathname === suffix || pathname.endsWith(suffix);
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

    if ((path === '/health' || matchesWishlistPath(path, '/wishlist/health')) && method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'native_worker' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (matchesWishlistPath(path, '/wishlist/add') && method === 'POST') return handleAdd(request, env);
    if (matchesWishlistPath(path, '/wishlist/remove') && method === 'POST') return handleRemove(request, env);
    if (matchesWishlistPath(path, '/wishlist/list') && method === 'GET') return handleList(request, env);
    if (matchesWishlistPath(path, '/wishlist/merge') && method === 'POST') return handleMerge(request, env);

    return new Response('Not Found', { status: 404 });
  },
};
