/**
 * Customer Account Wishlist — Profile Block Extension
 *
 * Target: customer-account.profile.block.render
 * API version: 2025-10 (Remote DOM mode)
 *
 * Notes:
 *  - s-grid is "coming soon" — use s-stack direction="inline" with card s-box children.
 *  - Card layout matches full-page wishlist: square image well, sharp corners, full-width CTAs.
 */

/** @jsxImportSource preact */
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { customerAccountGraphql } from './customerAccountGraphql.js';

const NAMESPACE = '$app';
const KEY = 'saved_products';
const DEFAULT_MAX_PREVIEW = 12;

const PROFILE_CAROUSEL_CARD_WIDTH = '220px';
const PROFILE_CAROUSEL_GAP_PX = 16;

/** Keep every carousel card identical width. */
function profileCardSizing() {
  return {
    inline: PROFILE_CAROUSEL_CARD_WIDTH,
    min: PROFILE_CAROUSEL_CARD_WIDTH,
    max: PROFILE_CAROUSEL_CARD_WIDTH,
  };
}

/** Give the inline track enough width to keep cards on a single row. */
function profileCarouselTrackWidth(itemCount) {
  const widthPx = itemCount * 220 + Math.max(0, itemCount - 1) * PROFILE_CAROUSEL_GAP_PX;
  return `${widthPx}px`;
}

/**
 * Parse merchant-configured preview size from extension settings.
 * Keeps values in a safe range for profile block performance.
 */
function getMaxPreview() {
  const raw = Number(shopify.settings?.max_preview);
  if (!Number.isFinite(raw)) return DEFAULT_MAX_PREVIEW;
  return Math.max(2, Math.min(20, Math.floor(raw)));
}

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

/**
 * Single product tile for the profile strip (bordered card, full-width button).
 */
function ProfileProductCard({ product, storeUrl, cardSizing }) {
  const productUrl =
    product.onlineStoreUrl ||
    (storeUrl ? `${storeUrl}/products/${product.handle}` : null);

  const price = shopify.i18n.formatCurrency(
    Number(product.priceRange.minVariantPrice.amount),
    { currency: product.priceRange.minVariantPrice.currencyCode }
  );

  const imageEl = product.featuredImage ? (
    <s-image
      src={product.featuredImage.url}
      alt={product.featuredImage.altText || product.title}
      aspect-ratio="1"
      object-fit="contain"
      inlineSize="fill"
      borderRadius="none"
      loading="lazy"
    />
  ) : null;

  return (
    <s-box
      borderRadius="none"
      border="base base"
      background="base"
      padding="small"
      overflow="hidden"
      inlineSize={cardSizing.inline}
      minInlineSize={cardSizing.min}
      maxInlineSize={cardSizing.max}
    >
      <s-stack direction="block" gap="small" inlineSize="fill" blockSize="100%">
        <s-box borderRadius="none" background="subdued" inlineSize="fill" overflow="hidden">
          {productUrl && imageEl ? (
            <s-link href={productUrl} target="_blank">
              {imageEl}
            </s-link>
          ) : (
            imageEl
          )}
        </s-box>

        <s-text type="strong">{product.title}</s-text>
        <s-text>{price}</s-text>

        {!product.availableForSale ? (
          <s-badge tone="warning">{shopify.i18n.translate('outOfStock')}</s-badge>
        ) : null}

      </s-stack>
    </s-box>
  );
}

function ViewAllCard({ wishlistPath, totalCount, cardSizing }) {
  return (
    <s-box
      borderRadius="none"
      border="base base"
      background="subdued"
      padding="small"
      overflow="hidden"
      inlineSize={cardSizing.inline}
      minInlineSize={cardSizing.min}
      maxInlineSize={cardSizing.max}
    >
      <s-stack direction="block" gap="small" inlineSize="fill" blockSize="100%" justifyContent="space-between">
        <s-stack direction="block" gap="small" inlineSize="fill">
          <s-text type="strong">{shopify.i18n.translate('viewWishlist')}</s-text>
          <s-text>{shopify.i18n.translate('viewAllCount', { count: totalCount })}</s-text>
        </s-stack>
        <s-button href={wishlistPath} inlineSize="fill" variant="primary">
          {shopify.i18n.translate('viewWishlist')}
        </s-button>
      </s-stack>
    </s-box>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

function WishlistProfileBlock() {
  const [products, setProducts] = useState(null); // null = loading
  const [totalCount, setTotalCount] = useState(0);
  const [storeUrl, setStoreUrl] = useState(null);
  const [error, setError] = useState(false);
  const [showViewAllCard, setShowViewAllCard] = useState(false);

  const wishlistPath =
    typeof shopify.settings?.wishlist_path === 'string'
      ? shopify.settings.wishlist_path.trim()
      : '';
  const maxPreview = getMaxPreview();

  useEffect(() => {
    (async () => {
      try {
        const allGids = await fetchWishlistGids();
        setTotalCount(allGids.length);
        const shouldReserveViewAllSlot = wishlistPath && allGids.length > maxPreview;
        const productSlots = shouldReserveViewAllSlot ? Math.max(1, maxPreview - 1) : maxPreview;
        const previewGids = allGids.slice(0, productSlots);
        const { products: details, storeUrl: url } = await fetchProductsAndShop(previewGids);
        setProducts(details);
        setStoreUrl(url);
        setShowViewAllCard(Boolean(shouldReserveViewAllSlot));
      } catch {
        setError(true);
        setProducts([]);
        setShowViewAllCard(false);
      }
    })();
  }, [wishlistPath, maxPreview]);

  const heading = shopify.i18n.translate('heading');

  if (products === null) {
    return (
      <s-stack direction="block" gap="small">
        <s-text type="strong">{heading}</s-text>
        <s-skeleton-paragraph content={shopify.i18n.translate('loading')} />
      </s-stack>
    );
  }

  if (error) {
    return (
      <s-stack direction="block" gap="small">
        <s-text type="strong">{heading}</s-text>
        <s-banner tone="critical">{shopify.i18n.translate('loadError')}</s-banner>
      </s-stack>
    );
  }

  if (products.length === 0) {
    return (
      <s-stack direction="block" gap="small" inlineSize="fill">
        <s-text type="strong">{heading}</s-text>
        <s-text>{shopify.i18n.translate('emptySubtitle')}</s-text>
        {wishlistPath ? (
          <s-button href={wishlistPath} inlineSize="fill" variant="primary">
            {shopify.i18n.translate('viewWishlist')}
          </s-button>
        ) : null}
      </s-stack>
    );
  }

  const viewAllLabel = totalCount > maxPreview
    ? `${shopify.i18n.translate('viewWishlist')} (${totalCount})`
    : shopify.i18n.translate('viewWishlist');

  const cardSizing = profileCardSizing();
  const visibleTileCount = products.length + (showViewAllCard ? 1 : 0);

  return (
    <s-stack direction="block" gap="base" inlineSize="fill">
      <s-text type="strong">{heading}</s-text>

      <s-scroll-box overflow="hidden auto" inlineSize="fill">
        <s-box inlineSize={profileCarouselTrackWidth(visibleTileCount)}>
          <s-stack direction="inline" gap="small" alignItems="stretch" inlineSize="fill">
            {products.map((product) => (
              <ProfileProductCard
                key={product.id}
                product={product}
                storeUrl={storeUrl}
                cardSizing={cardSizing}
              />
            ))}
            {showViewAllCard ? (
              <ViewAllCard
                wishlistPath={wishlistPath}
                totalCount={totalCount}
                cardSizing={cardSizing}
              />
            ) : null}
          </s-stack>
        </s-box>
      </s-scroll-box>

      {wishlistPath && !showViewAllCard ? (
        <s-button href={wishlistPath} inlineSize="fill" variant="secondary">
          {viewAllLabel}
        </s-button>
      ) : null}
    </s-stack>
  );
}

export default async () => {
  render(<WishlistProfileBlock />, document.body);
};
