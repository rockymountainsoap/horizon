/**
 * Customer Account Wishlist — Profile Block Extension
 *
 * Target: customer-account.profile.block.render
 * API version: 2025-10 (Remote DOM mode)
 *
 * Notes:
 *  - s-grid is "coming soon" in Polaris — use s-stack direction="inline" for multi-column layouts.
 *  - shopify.shop not available; use shopify.query() → shop.primaryDomain.url.
 *  - s-link href target="_blank" valid for external product links.
 *
 * Displays up to 4 wishlist products in a compact grid with clickable images/links.
 */

/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { customerAccountGraphql } from './customerAccountGraphql.js';

const NAMESPACE = '$app';
const KEY = 'saved_products';
const MAX_PREVIEW = 4;

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

// ── Component ─────────────────────────────────────────────────────────────────

function WishlistProfileBlock() {
  const [products, setProducts] = useState(null); // null = loading
  const [totalCount, setTotalCount] = useState(0);
  const [storeUrl, setStoreUrl] = useState(null);
  const [error, setError] = useState(false);

  const wishlistPath =
    typeof shopify.settings?.wishlist_path === 'string'
      ? shopify.settings.wishlist_path.trim()
      : '';

  useEffect(() => {
    (async () => {
      try {
        const allGids = await fetchWishlistGids();
        setTotalCount(allGids.length);
        const previewGids = allGids.slice(0, MAX_PREVIEW);
        const { products: details, storeUrl: url } = await fetchProductsAndShop(previewGids);
        setProducts(details);
        setStoreUrl(url);
      } catch {
        setError(true);
        setProducts([]);
      }
    })();
  }, []);

  const heading = shopify.i18n.translate('heading');

  // Loading state
  if (products === null) {
    return (
      <s-stack direction="block" gap="small">
        <s-text type="strong">{heading}</s-text>
        <s-skeleton-paragraph content={shopify.i18n.translate('loading')} />
      </s-stack>
    );
  }

  // Error state
  if (error) {
    return (
      <s-stack direction="block" gap="small">
        <s-text type="strong">{heading}</s-text>
        <s-banner tone="critical">{shopify.i18n.translate('loadError')}</s-banner>
      </s-stack>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <s-stack direction="block" gap="small">
        <s-text type="strong">{heading}</s-text>
        <s-text>{shopify.i18n.translate('emptySubtitle')}</s-text>
        {wishlistPath ? (
          <s-button href={wishlistPath}>{shopify.i18n.translate('viewWishlist')}</s-button>
        ) : null}
      </s-stack>
    );
  }

  const viewAllLabel = totalCount > MAX_PREVIEW
    ? `${shopify.i18n.translate('viewWishlist')} (${totalCount})`
    : shopify.i18n.translate('viewWishlist');

  return (
    <s-stack direction="block" gap="base">

      <s-text type="strong">{heading}</s-text>

      {/*
       * s-grid is "coming soon" in Polaris — its runtime sets grid-template-columns
       * to `none`. Use s-stack direction="inline" instead; items wrap naturally.
       */}
      <s-stack direction="inline" gap="small">
        {products.map((product) => {
          const productUrl =
            product.onlineStoreUrl ||
            (storeUrl ? `${storeUrl}/products/${product.handle}` : null);

          const price = shopify.i18n.formatCurrency(
            Number(product.priceRange.minVariantPrice.amount),
            { currency: product.priceRange.minVariantPrice.currencyCode }
          );

          return (
            <s-box key={product.id}>
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

              </s-stack>
            </s-box>
          );
        })}
      </s-stack>

      {wishlistPath ? (
        <s-button href={wishlistPath}>{viewAllLabel}</s-button>
      ) : null}

    </s-stack>
  );
}

// ── Registration ──────────────────────────────────────────────────────────────
export default async () => {
  render(<WishlistProfileBlock />, document.body);
};
