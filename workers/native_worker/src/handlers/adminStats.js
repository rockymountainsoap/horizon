/**
 * GET /admin/stats
 *
 * Aggregates wishlist data across every customer and returns:
 *   - totals: customers with a wishlist, items saved, average size
 *   - topProducts: most-wishlisted products (title/handle/image + count)
 *   - recent: most recently updated wishlists (customer email + count + ts)
 *
 * Cached in KV for ADMIN_STATS_TTL_SECONDS. Clients can force a fresh scan
 * by passing ?refresh=1.
 *
 * Auth: App Bridge session token (Authorization: Bearer <JWT>).
 */

import { withAdminAuth } from '../middleware/adminAuth.js';
import { getAdminToken } from '../shopify/tokens.js';
import { collectAllWishlists, getProductsLite, topProducts } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';
import {
  ADMIN_STATS_CACHE_KEY,
  ADMIN_STATS_TTL_SECONDS,
  ADMIN_TOP_PRODUCTS,
  ADMIN_RECENT_ROWS,
} from '../config.js';

/**
 * Run the full aggregation and return a payload suitable for the admin UI.
 * @param {string} shop
 * @param {string} adminToken
 */
async function buildStats(shop, adminToken) {
  const startedAt = Date.now();
  const rows = await collectAllWishlists(shop, adminToken, { pageSize: 100, maxPages: 500 });

  const totalCustomers = rows.length;
  const totalItems = rows.reduce((sum, r) => sum + r.productGids.length, 0);
  const avgSize = totalCustomers > 0 ? totalItems / totalCustomers : 0;

  const top = topProducts(rows, ADMIN_TOP_PRODUCTS);
  const productLookup = await getProductsLite(
    shop,
    adminToken,
    top.map((t) => t.id)
  );

  const topProductsResolved = top.map(({ id, count }) => {
    const p = productLookup[id] ?? null;
    return {
      id,
      count,
      title: p?.title ?? '(product removed)',
      handle: p?.handle ?? null,
      status: p?.status ?? null,
      image: p?.featuredImage?.url ?? null,
    };
  });

  const recent = rows
    .filter((r) => r.updatedAt)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, ADMIN_RECENT_ROWS)
    .map((r) => ({
      customerGid: r.customerGid,
      email: r.email,
      name: r.name,
      count: r.productGids.length,
      updatedAt: r.updatedAt,
    }));

  return {
    ok: true,
    shop,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    totals: {
      customers: totalCustomers,
      items: totalItems,
      averageSize: Number(avgSize.toFixed(2)),
    },
    topProducts: topProductsResolved,
    recent,
  };
}

export function handleAdminStats(request, env) {
  return withAdminAuth(request, env, async ({ shop }) => {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';
    const kv = env.APP_KV;

    if (!forceRefresh && kv && typeof kv.get === 'function') {
      const cached = await kv.get(ADMIN_STATS_CACHE_KEY, { type: 'json' });
      if (cached) {
        return jsonResponse({ ...cached, cached: true }, 200, request, env);
      }
    }

    const adminToken = await getAdminToken(env, shop);
    const payload = await buildStats(shop, adminToken);

    if (kv && typeof kv.put === 'function') {
      await kv.put(ADMIN_STATS_CACHE_KEY, JSON.stringify(payload), {
        expirationTtl: ADMIN_STATS_TTL_SECONDS,
      });
    }

    return jsonResponse({ ...payload, cached: false }, 200, request, env);
  });
}
