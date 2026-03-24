import '@shopify/ui-extensions/customer-account/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useApi, useSettings } from '@shopify/ui-extensions/customer-account/preact';

export default function extension() {
  render(<WishlistProfileBlock />, document.body);
}

function WishlistProfileBlock() {
  const shopify = useApi();
  const settings = useSettings();
  const [count, setCount] = useState(/** @type {number | null} */ (null));

  const wishlistPath =
    typeof settings?.wishlist_path === 'string' ? settings.wishlist_path.trim() : '';

  useEffect(() => {
    shopify
      .query(
        `
      query {
        customer {
          metafield(namespace: "$app:wishlist", key: "saved_products") {
            value
          }
        }
      }
    `
      )
      .then((data) => {
        const raw = data.data?.customer?.metafield?.value;
        let list = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            list = Array.isArray(parsed) ? parsed : [];
          } catch {
            list = [];
          }
        }
        setCount(list.length);
      })
      .catch(() => setCount(0));
  }, [shopify]);

  const label =
    count === null
      ? shopify.i18n.translate('viewWishlist')
      : count === 0
        ? shopify.i18n.translate('viewWishlist')
        : shopify.i18n.translate('viewWishlist') + ` (${count})`;

  const subtitle =
    count === null
      ? shopify.i18n.translate('loading')
      : count === 0
        ? shopify.i18n.translate('emptySubtitle')
        : shopify.i18n.translate('countSubtitle', { count: String(count) });

  return (
    <s-section heading={shopify.i18n.translate('heading')}>
      <s-stack direction="block" gap="small-500">
        <s-text color="subdued">{subtitle}</s-text>
        {wishlistPath ? (
          <s-button href={wishlistPath} variant="primary">
            {label}
          </s-button>
        ) : (
          <s-text color="subdued">{shopify.i18n.translate('configurePath')}</s-text>
        )}
      </s-stack>
    </s-section>
  );
}
