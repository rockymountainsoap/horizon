import '@shopify/ui-extensions/customer-account/preact';
import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useApi } from '@shopify/ui-extensions/customer-account/preact';

const NAMESPACE = '$app:wishlist';
const KEY = 'saved_products';
const PROXY_BASE = '/apps/wishlist';

export default function extension() {
  render(<WishlistPage />, document.body);
}

/**
 * @param {import('@shopify/ui-extensions/customer-account').StandardApi} api
 */
async function fetchWishlistGids(api) {
  const result = await api.query(
    `
    query GetWishlist {
      customer {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          value
        }
      }
    }
  `
  );
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(', '));
  }
  const raw = result.data?.customer?.metafield?.value;
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * @param {import('@shopify/ui-extensions/customer-account').StandardApi} api
 * @param {string[]} gids
 */
async function fetchProductDetails(api, gids) {
  if (!gids.length) return [];
  const result = await api.query(
    `
    query GetProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          onlineStoreUrl
          availableForSale
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
        }
      }
    }
  `,
    { variables: { ids: gids } }
  );
  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join(', '));
  }
  return (result.data?.nodes ?? []).filter(Boolean);
}

function WishlistPage() {
  const shopify = useApi();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gids = await fetchWishlistGids(shopify);
      const details = await fetchProductDetails(shopify, gids);
      setProducts(details);
    } catch (e) {
      setError(shopify.i18n.translate('loadError'));
    } finally {
      setLoading(false);
    }
  }, [shopify]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  /**
   * @param {string} productGid
   */
  async function removeItem(productGid) {
    setRemoving(productGid);
    try {
      const res = await fetch(`${PROXY_BASE}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productGid }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setProducts((prev) => prev.filter((p) => p.id !== productGid));
    } catch {
      /* keep list; merchant may need CORS / proxy alignment for account host */
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <s-page heading={shopify.i18n.translate('heading')}>
        <s-skeleton-text lines={4} />
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading={shopify.i18n.translate('heading')}>
        <s-banner status="critical">{error}</s-banner>
      </s-page>
    );
  }

  if (products.length === 0) {
    return (
      <s-page heading={shopify.i18n.translate('heading')}>
        <s-section>
          <s-stack direction="block" gap="base" inlineAlignment="center">
            <s-text>{shopify.i18n.translate('empty')}</s-text>
            <s-button href="/">{shopify.i18n.translate('startShopping')}</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={`${shopify.i18n.translate('heading')} (${products.length})`}>
      <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
        {products.map((product) => (
          <s-section key={product.id}>
            {product.featuredImage ? (
              <s-image
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
              />
            ) : null}
            <s-stack direction="block" gap="small-500">
              <s-text type="strong">{product.title}</s-text>
              <s-text color="subdued">
                {shopify.i18n.formatCurrency(Number(product.priceRange.minVariantPrice.amount), {
                  currency: product.priceRange.minVariantPrice.currencyCode,
                })}
              </s-text>
              {!product.availableForSale ? (
                <s-badge status="warning">{shopify.i18n.translate('outOfStock')}</s-badge>
              ) : null}
            </s-stack>
            <s-button slot="primary-action" href={product.onlineStoreUrl}>
              {shopify.i18n.translate('viewProduct')}
            </s-button>
            <s-button
              slot="secondary-actions"
              loading={removing === product.id}
              onClick={() => removeItem(product.id)}
            >
              {shopify.i18n.translate('remove')}
            </s-button>
          </s-section>
        ))}
      </s-grid>
    </s-page>
  );
}
