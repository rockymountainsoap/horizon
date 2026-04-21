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

/**
 * @typedef {Object} CustomerWishlistRow
 * @property {string} customerGid      gid://shopify/Customer/123
 * @property {string} email
 * @property {string} name
 * @property {string[]} productGids    Saved product GIDs
 * @property {string | null} updatedAt ISO timestamp of last wishlist update
 */

/**
 * Paginate through every customer and collect those with a non-empty wishlist
 * metafield. Stops after `maxPages` pages as a safety cap.
 *
 * @param {string} shop
 * @param {string} token
 * @param {{ pageSize?: number; maxPages?: number }} [opts]
 * @returns {Promise<CustomerWishlistRow[]>}
 */
export async function collectAllWishlists(shop, token, { pageSize = 100, maxPages = 200 } = {}) {
  /** @type {CustomerWishlistRow[]} */
  const rows = [];
  let cursor = null;
  let pages = 0;

  const query = `
    query AllWishlists($cursor: String, $pageSize: Int!) {
      customers(first: $pageSize, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            email
            firstName
            lastName
            metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
              value
              updatedAt
            }
          }
        }
      }
    }
  `;

  while (pages < maxPages) {
    const res = await adminFetch(shop, token, query, { cursor, pageSize });
    const data = await res.json();

    if (data.errors?.length) {
      console.error('[adminApi] collectAllWishlists errors:', JSON.stringify(data.errors));
      throw new Error('Failed to paginate wishlists');
    }

    const conn = data.data?.customers;
    if (!conn) break;

    for (const edge of conn.edges ?? []) {
      const node = edge.node ?? {};
      const list = parseListValue(node.metafield?.value);
      if (list.length === 0) continue;

      rows.push({
        customerGid: String(node.id),
        email: String(node.email ?? ''),
        name: [node.firstName, node.lastName].filter(Boolean).join(' ').trim(),
        productGids: list,
        updatedAt: node.metafield?.updatedAt ?? null,
      });
    }

    pages += 1;
    if (!conn.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return rows;
}

/**
 * Fetch product titles/handles/status for a list of product GIDs.
 * Used to label the top-wishlisted products in the admin page.
 *
 * @param {string} shop
 * @param {string} token
 * @param {string[]} ids
 * @returns {Promise<Record<string, { id: string; title: string; handle: string; status: string; featuredImage: { url: string; altText: string | null } | null }>>}
 */
export async function getProductsLite(shop, token, ids) {
  if (!ids.length) return {};

  const res = await adminFetch(
    shop,
    token,
    `query ProductsLite($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          status
          featuredImage { url altText }
        }
      }
    }`,
    { ids }
  );

  const data = await res.json();
  if (data.errors?.length) {
    console.error('[adminApi] getProductsLite errors:', JSON.stringify(data.errors));
    return {};
  }

  /** @type {Record<string, any>} */
  const out = {};
  for (const node of data.data?.nodes ?? []) {
    if (node?.id) out[node.id] = node;
  }
  return out;
}

/**
 * Compute the top-N most-wishlisted product GIDs (and their counts) from a
 * collection of wishlist rows.
 *
 * @param {CustomerWishlistRow[]} rows
 * @param {number} limit
 */
export function topProducts(rows, limit = 20) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of rows) {
    for (const gid of row.productGids) {
      counts.set(gid, (counts.get(gid) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ id, count }));
}
