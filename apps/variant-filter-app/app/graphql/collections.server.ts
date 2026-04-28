export const LIST_COLLECTIONS = `#graphql
  query ListCollections($first: Int!, $after: String, $before: String) {
    collections(first: $first, after: $after, before: $before, sortKey: TITLE) {
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

export const GET_PRODUCT_OPTIONS = `#graphql
  query GetProductOptions($first: Int!) {
    products(first: $first) {
      edges {
        node {
          options {
            name
          }
        }
      }
    }
  }
`;
