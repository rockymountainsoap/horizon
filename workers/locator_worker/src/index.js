import { handleStores } from './handlers/stores.js';
import { handleStore } from './handlers/store.js';
import { handleStoreEmail } from './handlers/storeEmail.js';
import { handleInventory } from './handlers/inventory.js';
import { corsPreflightResponse } from './middleware/cors.js';
import { errorResponse, jsonResponse } from './utils/response.js';
import {
  AuthError,
  NotFoundError,
  UpstreamError,
  ValidationError,
} from './utils/errors.js';

/**
 * Map a thrown error to an HTTP response. Keeps handler code free of try/catch
 * and ensures every path returns a CORS-safe JSON body.
 *
 * @param {unknown} err
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
function errorToResponse(err, request, env) {
  if (err instanceof ValidationError) {
    return errorResponse(err.message, 422, request, env);
  }
  if (err instanceof AuthError) {
    return errorResponse(err.message, 401, request, env);
  }
  if (err instanceof NotFoundError) {
    return errorResponse(err.message, 404, request, env);
  }
  if (err instanceof UpstreamError) {
    return errorResponse(err.message, err.status ?? 502, request, env);
  }
  console.error('[index] unhandled error:', err);
  return errorResponse('internal_error', 500, request, env);
}

/** Match GET /stores/:handle and GET /stores/:handle/email */
const STORE_DETAIL_RE  = /^\/stores\/([^/]+)$/;
const STORE_EMAIL_RE   = /^\/stores\/([^/]+)\/email$/;

export default {
  /**
   * @param {Request} request
   * @param {Record<string, unknown>} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') return corsPreflightResponse(request, env);

    try {
      if (path === '/health' && method === 'GET') {
        return jsonResponse({ ok: true, service: 'locator_worker' }, 200, request, env);
      }

      if (path === '/stores' && method === 'GET') {
        return await handleStores(request, env);
      }

      const emailMatch = STORE_EMAIL_RE.exec(path);
      if (emailMatch && method === 'GET') {
        return await handleStoreEmail(request, env, decodeURIComponent(emailMatch[1]));
      }

      const detailMatch = STORE_DETAIL_RE.exec(path);
      if (detailMatch && method === 'GET') {
        return await handleStore(request, env, decodeURIComponent(detailMatch[1]));
      }

      if (path === '/inventory' && method === 'GET') {
        return await handleInventory(request, env);
      }

      return errorResponse('not_found', 404, request, env);
    } catch (err) {
      return errorToResponse(err, request, env);
    }
  },
};
