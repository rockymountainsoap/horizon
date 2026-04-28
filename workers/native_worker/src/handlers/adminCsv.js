/**
 * GET /admin/stats.csv
 *
 * Returns every (customer, product) pair across all wishlists as CSV.
 * Columns:
 *   customer_email, customer_name, customer_gid, product_gid,
 *   product_title, product_handle, wishlist_size, updated_at
 *
 * Auth: App Bridge session token (Authorization: Bearer <JWT>).
 *
 * Not cached — this is a manual export action and should always reflect the
 * freshest Admin API state.
 */

import { withAdminAuth } from '../middleware/adminAuth.js';
import { getAdminToken } from '../shopify/tokens.js';
import { collectAllWishlists, getProductsLite } from '../shopify/adminApi.js';
import { corsHeaders } from '../utils/response.js';

/**
 * Escape a value for RFC 4180 CSV. Wraps in double quotes when needed and
 * escapes embedded quotes.
 * @param {unknown} v
 */
function csv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Batch an array into chunks of the given size. */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function handleAdminCsv(request, env) {
  return withAdminAuth(request, env, async ({ shop }) => {
    const adminToken = await getAdminToken(env, shop);
    const rows = await collectAllWishlists(shop, adminToken, { pageSize: 100, maxPages: 500 });

    // Collect every unique product GID across all wishlists so we can
    // label the CSV rows with title + handle.
    const uniqueIds = [...new Set(rows.flatMap((r) => r.productGids))];
    /** @type {Record<string, any>} */
    const productLookup = {};
    for (const batch of chunk(uniqueIds, 100)) {
      Object.assign(productLookup, await getProductsLite(shop, adminToken, batch));
    }

    const header = [
      'customer_email',
      'customer_name',
      'customer_gid',
      'product_gid',
      'product_title',
      'product_handle',
      'wishlist_size',
      'updated_at',
    ].join(',');

    const lines = [header];
    for (const row of rows) {
      for (const gid of row.productGids) {
        const p = productLookup[gid];
        lines.push([
          csv(row.email),
          csv(row.name),
          csv(row.customerGid),
          csv(gid),
          csv(p?.title ?? ''),
          csv(p?.handle ?? ''),
          csv(row.productGids.length),
          csv(row.updatedAt ?? ''),
        ].join(','));
      }
    }

    const filename = `wishlists-${new Date().toISOString().slice(0, 10)}.csv`;

    // Build headers from corsHeaders but override Content-Type for CSV so the
    // browser triggers a download rather than trying to render it.
    const headers = {
      ...corsHeaders(request, env),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };

    return new Response(lines.join('\r\n'), { status: 200, headers });
  });
}
