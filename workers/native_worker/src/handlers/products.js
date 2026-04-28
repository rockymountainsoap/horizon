import { withSecurity } from '../middleware/security.js';
import { getAdminToken } from '../shopify/tokens.js';
import { jsonResponse } from '../utils/response.js';
import { ADMIN_API_VERSION, MAX_PRODUCT_IDS } from '../config.js';

/**
 * GET /wishlist/products?ids=gid://shopify/Product/123,gid://...
 * Returns product details (title, handle, image, variants) for the header mini-wishlist drawer.
 *
 * Note: Admin API returns ProductVariant.price as a scalar Money (decimal string),
 * not MoneyV2. Currency code is fetched from priceRange.minVariantPrice.currencyCode.
 */
export function handleProducts(request, env) {
  return withSecurity(request, env, async ({ shop }) => {
    const adminToken = await getAdminToken(env, shop);

    const url = new URL(request.url);
    const idsParam = url.searchParams.get('ids') ?? '';
    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('gid://shopify/Product/'))
      .slice(0, MAX_PRODUCT_IDS);

    if (!ids.length) {
      return jsonResponse({ ok: true, products: [] }, 200, request, env);
    }

    const res = await fetch(
      `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          query: `
            query WishlistProductDetails($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  title
                  handle
                  onlineStoreUrl
                  status
                  featuredImage { url altText }
                  priceRange {
                    minVariantPrice { currencyCode }
                  }
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
                        availableForSale
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { ids },
        }),
      }
    );

    const data = await res.json();

    if (data.errors?.length) {
      console.error('[products] Admin API errors:', JSON.stringify(data.errors));
      return jsonResponse({ ok: false, reason: 'admin_api_error' }, 502, request, env);
    }

    const products = (data.data?.nodes ?? []).filter(Boolean);
    return jsonResponse({ ok: true, products }, 200, request, env);
  }, { requireAuth: false });
}
