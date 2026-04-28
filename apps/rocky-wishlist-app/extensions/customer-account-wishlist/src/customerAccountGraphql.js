/**
 * Customer Account UI extensions: `useApi().query()` hits the Storefront API only.
 * Customer metafields and `metafieldsSet` must use the Customer Account GraphQL API.
 * @see https://shopify.dev/docs/api/customer-account-ui-extensions/latest/target-apis/customer-account-api
 */
const CUSTOMER_ACCOUNT_API_VERSION = '2025-10';

/**
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 * @returns {Promise<{ data?: unknown; errors?: readonly { message: string }[] }>}
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
