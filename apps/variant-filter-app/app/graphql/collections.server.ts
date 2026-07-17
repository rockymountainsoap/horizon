export const LIST_COLLECTIONS = `#graphql
  query ListCollections($first: Int, $after: String, $last: Int, $before: String) {
    collections(first: $first, after: $after, last: $last, before: $before, sortKey: TITLE) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          metafield(namespace: "variant-filter", key: "rule") {
            id
            value
          }
        }
      }
    }
  }
`;

export const GET_COLLECTION_WITH_RULE = `#graphql
  query GetCollectionWithRule($id: ID!) {
    collection(id: $id) {
      id
      title
      handle
      metafield(namespace: "variant-filter", key: "rule") {
        id
        value
      }
    }
  }
`;

// Scoped to the collection being edited (not a shop-wide product sample) and
// paginated so option names beyond the first page still appear in the editor.
export const GET_COLLECTION_PRODUCT_OPTIONS = `#graphql
  query GetCollectionProductOptions($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          options {
            name
          }
        }
      }
    }
  }
`;
