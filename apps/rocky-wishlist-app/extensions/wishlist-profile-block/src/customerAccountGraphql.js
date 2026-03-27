/** @see ../customer-account-wishlist/src/customerAccountGraphql.js */
const CUSTOMER_ACCOUNT_API_VERSION = '2025-10';

/**
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export async function customerAccountGraphql(query, variables) {
  const res = await fetch(
    `shopify://customer-account/api/${CUSTOMER_ACCOUNT_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    }
  );
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(', '));
  }
  return json;
}
