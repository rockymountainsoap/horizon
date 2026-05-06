import { fetchStoreLocationEmail } from '../shopify/adminApi.js';
import { validateHandle } from '../middleware/validate.js';
import { jsonResponse } from '../utils/response.js';

/**
 * Reveal the email for a single store. PII — never cached at the edge.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {string} rawHandle
 */
export async function handleStoreEmail(request, env, rawHandle) {
  const handle = validateHandle(rawHandle);
  const email = await fetchStoreLocationEmail(env, env.SHOP_DOMAIN, handle);

  return jsonResponse({ ok: true, email }, 200, request, env, {
    cacheControl: 'no-store, no-cache, must-revalidate',
  });
}
