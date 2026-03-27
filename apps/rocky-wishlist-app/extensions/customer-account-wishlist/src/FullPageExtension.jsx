/**
 * Customer Account Wishlist — Full Page Extension
 *
 * Target: customer-account.page.render
 * API version: 2025-10 (Remote DOM mode)
 *
 * Architecture notes:
 *  - READ: Customer Account GraphQL API (shopify://customer-account/...) can read
 *    the $app namespace metafield set by the Worker.
 *
 *  - WRITE (remove): The $app namespace is app-owned and write-protected — the
 *    Customer Account API rejects direct writes with "Access to this namespace
 *    and key on Metafields for this resource type is not allowed."
 *    Remove is sent DIRECTLY to the Worker (not via App Proxy). The App Proxy
 *    returns 302 for cross-origin requests without a storefront session cookie,
 *    which extensions.shopifycdn.com cannot provide.
 *
 *    Auth: shopify.sessionToken.get() returns an HS256 JWT signed with the app
 *    client secret. The Worker validates it, extracts the customer GID from the
 *    `sub` claim, and performs the Admin API write.
 *    URL: https://native-wishlist-worker.rocky-mountain-soap.workers.dev/wishlist/ext/remove
 *
 *  - s-grid (Polaris web component) is officially "coming soon" — the runtime
 *    sets grid-template-columns to `none` regardless of the value provided,
 *    including responsive @container syntax. Use s-stack direction="inline"
 *    with s-box children for a reliable multi-column layout.
 *
 *  - shopify.shop is NOT available on customer-account.page.render (StandardApi only).
 *    Shop domain is fetched via shopify.query() → shop { primaryDomain { url } }.
 *    Product URL priority: onlineStoreUrl → storeUrl + /products/ + handle → null (no link)
 *
 * APIs used:
 *  - customerAccountGraphql()       → customer metafield reads only
 *  - shopify.query()                → Storefront API: product details + shop primaryDomain
 *  - shopify.sessionToken.get()     → HS256 JWT for Worker authentication
 *  - fetch(WORKER_EXT_REMOVE_URL)   → Worker direct call: remove (session token auth)
 *  - shopify.i18n                   → translations + currency formatting
 */

/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { customerAccountGraphql } from './customerAccountGraphql.js';

const NAMESPACE = '$app';
const KEY = 'saved_products';

/**
 * Direct Worker URL for extension-originated remove requests.
 * The App Proxy cannot be used from extensions.shopifycdn.com — Shopify returns
 * 302 for any cross-origin request that lacks a storefront session cookie.
 */
const WORKER_EXT_REMOVE_URL =
  'https://native-wishlist-worker.rocky-mountain-soap.workers.dev/wishlist/ext/remove';

// ── Data helpers ─────────────────────────────────────────────────────────────

async function fetchWishlistGids() {
  const json = await customerAccountGraphql(
    `query GetWishlist {
      customer {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          value
        }
      }
    }`
  );
  const raw = json.data?.customer?.metafield?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Fetches product details + shop primary domain in one Storefront API call.
 * shop.primaryDomain.url is the fallback URL base when onlineStoreUrl is null
 * (i.e. the product is not published to the Online Store channel).
 */
async function fetchProductsAndShop(gids) {
  if (!gids.length) return { products: [], storeUrl: null };

  const result = await shopify.query(
    `query WishlistProducts($ids: [ID!]!) {
      shop {
        primaryDomain { url }
      }
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          onlineStoreUrl
          availableForSale
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
        }
      }
    }`,
    { variables: { ids: gids } }
  );

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(', '));
  }

  const storeUrl = result.data?.shop?.primaryDomain?.url ?? null;
  const products = (result.data?.nodes ?? []).filter(Boolean);
  return { products, storeUrl };
}

/**
 * Remove a product from the wishlist by calling the Worker directly.
 *
 * Uses a Shopify session token (HS256 JWT) for authentication. The Worker
 * validates the token using the shared app client secret, extracts the
 * customer GID from the `sub` claim, and performs the Admin API write.
 *
 * The App Proxy URL cannot be used here because Shopify returns 302 for any
 * cross-origin request that does not carry a storefront session cookie — which
 * is impossible from extensions.shopifycdn.com.
 *
 * @param {string} removeGid  Product GID to remove
 * @returns {Promise<string[]>} Updated GID list from the Worker
 */
async function removeFromWishlist(removeGid) {
  // Fresh session token on every call — sessionToken.get() returns cached tokens
  // when valid so this is efficient.
  const token = await shopify.sessionToken.get();

  const res = await fetch(WORKER_EXT_REMOVE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productGid: removeGid }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`remove ${res.status}${text ? ` — ${text}` : ''}`);
  }

  const data = await res.json();
  if (!data.ok) throw new Error(data.reason || 'remove failed');

  return Array.isArray(data.list) ? data.list : [];
}

// ── ProductCard component ─────────────────────────────────────────────────────

function ProductCard({ product, storeUrl, removing, onRemove }) {
  const price = shopify.i18n.formatCurrency(
    Number(product.priceRange.minVariantPrice.amount),
    { currency: product.priceRange.minVariantPrice.currencyCode }
  );

  // Prefer onlineStoreUrl; fall back to constructing from shop domain + handle
  const productUrl =
    product.onlineStoreUrl ||
    (storeUrl ? `${storeUrl}/products/${product.handle}` : null);

  return (
    <s-stack direction="block" gap="small">

      {productUrl ? (
        <s-link href={productUrl} target="_blank">
          {product.featuredImage ? (
            <s-image
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              aspect-ratio="1"
              object-fit="cover"
            />
          ) : null}
        </s-link>
      ) : product.featuredImage ? (
        <s-image
          src={product.featuredImage.url}
          alt={product.featuredImage.altText || product.title}
          aspect-ratio="1"
          object-fit="cover"
        />
      ) : null}

      <s-text type="strong">{product.title}</s-text>

      <s-text>{price}</s-text>

      {!product.availableForSale ? (
        <s-badge tone="warning">{shopify.i18n.translate('outOfStock')}</s-badge>
      ) : null}

      <s-stack direction="inline" gap="small">
        {productUrl ? (
          <s-button href={productUrl} target="_blank">
            {shopify.i18n.translate('viewProduct')}
          </s-button>
        ) : null}

        <s-button
          variant="secondary"
          disabled={removing === product.id}
          onClick={() => onRemove(product.id)}
        >
          {removing === product.id ? '…' : shopify.i18n.translate('remove')}
        </s-button>
      </s-stack>

    </s-stack>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

function WishlistPage() {
  const [gids, setGids] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeUrl, setStoreUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const [error, setError] = useState(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wishlistGids = await fetchWishlistGids();
      setGids(wishlistGids);
      const { products: details, storeUrl: url } = await fetchProductsAndShop(wishlistGids);
      setProducts(details);
      setStoreUrl(url);
    } catch {
      setError(shopify.i18n.translate('loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const removeItem = useCallback(async (productGid) => {
    setRemoving(productGid);
    setRemoveError(null);
    try {
      const updatedGids = await removeFromWishlist(productGid);
      setGids(updatedGids);
      setProducts((prev) => prev.filter((p) => p.id !== productGid));
    } catch (err) {
      setRemoveError(err?.message || 'Failed to remove item');
    } finally {
      setRemoving(null);
    }
  }, []);

  const heading = loading || products.length === 0
    ? shopify.i18n.translate('heading')
    : `${shopify.i18n.translate('heading')} (${products.length})`;

  if (loading) {
    return (
      <s-page heading={heading}>
        <s-section>
          <s-skeleton-paragraph content="Loading wishlist..." />
        </s-section>
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading={heading}>
        <s-section>
          <s-banner tone="critical">{error}</s-banner>
        </s-section>
      </s-page>
    );
  }

  if (products.length === 0) {
    return (
      <s-page heading={heading}>
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>{shopify.i18n.translate('empty')}</s-text>
            <s-button href="shopify:customer-account/">
              {shopify.i18n.translate('startShopping')}
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={heading}>
      <s-section>
        {removeError ? (
          <s-banner tone="critical">{removeError}</s-banner>
        ) : null}

        {/*
         * s-grid is "coming soon" in Polaris — its runtime sets grid-template-columns
         * to `none` regardless of value. Use s-stack direction="inline" instead:
         * items wrap naturally and each s-box takes ~50% width via the layout engine.
         */}
        <s-stack direction="inline" gap="base">
          {products.map((product) => (
            <s-box key={product.id}>
              <ProductCard
                product={product}
                storeUrl={storeUrl}
                removing={removing}
                onRemove={removeItem}
              />
            </s-box>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

// ── Registration ──────────────────────────────────────────────────────────────
// api_version = "2025-10" → CLI generates Remote DOM wrapper; document.body
// is available when this callback runs.
export default async () => {
  render(<WishlistPage />, document.body);
};
