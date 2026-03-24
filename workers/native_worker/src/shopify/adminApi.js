const NAMESPACE = '$app:wishlist';
const KEY = 'saved_products';
const ADMIN_API_VERSION = '2025-04';

function adminFetch(shop, token, query, variables = {}) {
  return fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
}

function parseListValue(raw) {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getWishlist(customerId, shop, token) {
  const res = await adminFetch(
    shop,
    token,
    `
    query GetWishlist($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          id
          value
          updatedAt
        }
      }
    }
  `,
    { id: `gid://shopify/Customer/${customerId}` }
  );

  const data = await res.json();

  if (data.errors) {
    console.error('Admin API errors:', data.errors);
    throw new Error('Failed to read wishlist');
  }

  const metafield = data.data?.customer?.metafield;
  const list = parseListValue(metafield?.value);
  return { list, metafieldId: metafield?.id ?? null };
}

export async function setWishlist(customerId, list, shop, token) {
  const res = await adminFetch(
    shop,
    token,
    `
    mutation SetWishlist($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id value updatedAt }
        userErrors { field message }
      }
    }
  `,
    {
      metafields: [
        {
          ownerId: `gid://shopify/Customer/${customerId}`,
          namespace: NAMESPACE,
          key: KEY,
          type: 'list.product_reference',
          value: JSON.stringify(list),
        },
      ],
    }
  );

  const data = await res.json();
  const userErrors = data.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    console.error('metafieldsSet userErrors:', userErrors);
    throw new Error('Failed to update wishlist');
  }

  return data.data?.metafieldsSet?.metafields?.[0];
}
