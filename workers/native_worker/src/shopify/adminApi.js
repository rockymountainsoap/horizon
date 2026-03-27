import { ADMIN_API_VERSION } from '../config.js';

const NAMESPACE = '$app';
const KEY = 'saved_products';

/**
 * Execute a GraphQL query against the Shopify Admin API.
 * @param {string} shop
 * @param {string} token
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
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

/**
 * Parse a JSON-encoded product reference list metafield value.
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseListValue(raw) {
  if (raw == null || raw === '') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Read the wishlist metafield for a customer.
 * @param {string} customerId  Numeric Shopify customer ID
 * @param {string} shop        e.g. "store.myshopify.com"
 * @param {string} token       Admin API access token
 */
export async function getWishlist(customerId, shop, token) {
  const res = await adminFetch(
    shop,
    token,
    `query GetWishlist($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          id
          value
          updatedAt
        }
      }
    }`,
    { id: `gid://shopify/Customer/${customerId}` }
  );

  const data = await res.json();

  if (data.errors) {
    console.error('[adminApi] getWishlist errors:', JSON.stringify(data.errors));
    throw new Error('Failed to read wishlist');
  }

  const metafield = data.data?.customer?.metafield;
  return {
    list: parseListValue(metafield?.value),
    metafieldId: metafield?.id ?? null,
  };
}

/**
 * Write the wishlist metafield for a customer.
 * @param {string} customerId
 * @param {string[]} list
 * @param {string} shop
 * @param {string} token
 */
export async function setWishlist(customerId, list, shop, token) {
  const res = await adminFetch(
    shop,
    token,
    `mutation SetWishlist($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id value updatedAt }
        userErrors { field message }
      }
    }`,
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
    console.error('[adminApi] setWishlist userErrors:', JSON.stringify(userErrors));
    throw new Error('Failed to update wishlist');
  }

  return data.data?.metafieldsSet?.metafields?.[0];
}
