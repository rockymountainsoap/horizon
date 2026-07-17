/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type ListCollectionsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
  after?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
  before?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type ListCollectionsQuery = { collections: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'hasPreviousPage' | 'startCursor' | 'endCursor'>, edges: Array<{ node: (
        Pick<AdminTypes.Collection, 'id' | 'title' | 'handle'>
        & { metafield?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'id' | 'value'>> }
      ) }> } };

export type GetCollectionWithRuleQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type GetCollectionWithRuleQuery = { collection?: AdminTypes.Maybe<(
    Pick<AdminTypes.Collection, 'id' | 'title' | 'handle'>
    & { metafield?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'id' | 'value'>> }
  )> };

export type GetProductOptionsQueryVariables = AdminTypes.Exact<{
  first: AdminTypes.Scalars['Int']['input'];
}>;


export type GetProductOptionsQuery = { products: { edges: Array<{ node: { options: Array<Pick<AdminTypes.ProductOption, 'name'>> } }> } };

export type RegisterVariantFilterDefinitionMutationVariables = AdminTypes.Exact<{
  definition: AdminTypes.MetafieldDefinitionInput;
}>;


export type RegisterVariantFilterDefinitionMutation = { metafieldDefinitionCreate?: AdminTypes.Maybe<{ createdDefinition?: AdminTypes.Maybe<Pick<AdminTypes.MetafieldDefinition, 'id' | 'namespace' | 'key'>>, userErrors: Array<Pick<AdminTypes.MetafieldDefinitionCreateUserError, 'field' | 'message' | 'code'>> }> };

export type SetVariantFilterRuleMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type SetVariantFilterRuleMutation = { metafieldsSet?: AdminTypes.Maybe<{ metafields?: AdminTypes.Maybe<Array<Pick<AdminTypes.Metafield, 'id' | 'namespace' | 'key' | 'value'>>>, userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message' | 'code'>> }> };

export type DeleteVariantFilterRuleMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldIdentifierInput> | AdminTypes.MetafieldIdentifierInput;
}>;


export type DeleteVariantFilterRuleMutation = { metafieldsDelete?: AdminTypes.Maybe<{ deletedMetafields?: AdminTypes.Maybe<Array<AdminTypes.Maybe<Pick<AdminTypes.MetafieldIdentifier, 'ownerId' | 'namespace' | 'key'>>>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query ListCollections($first: Int!, $after: String, $before: String) {\n    collections(first: $first, after: $after, before: $before, sortKey: TITLE) {\n      pageInfo {\n        hasNextPage\n        hasPreviousPage\n        startCursor\n        endCursor\n      }\n      edges {\n        node {\n          id\n          title\n          handle\n          metafield(namespace: \"variant-filter\", key: \"rule\") {\n            id\n            value\n          }\n        }\n      }\n    }\n  }\n": {return: ListCollectionsQuery, variables: ListCollectionsQueryVariables},
  "#graphql\n  query GetCollectionWithRule($id: ID!) {\n    collection(id: $id) {\n      id\n      title\n      handle\n      metafield(namespace: \"variant-filter\", key: \"rule\") {\n        id\n        value\n      }\n    }\n  }\n": {return: GetCollectionWithRuleQuery, variables: GetCollectionWithRuleQueryVariables},
  "#graphql\n  query GetProductOptions($first: Int!) {\n    products(first: $first) {\n      edges {\n        node {\n          options {\n            name\n          }\n        }\n      }\n    }\n  }\n": {return: GetProductOptionsQuery, variables: GetProductOptionsQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation RegisterVariantFilterDefinition($definition: MetafieldDefinitionInput!) {\n    metafieldDefinitionCreate(definition: $definition) {\n      createdDefinition {\n        id\n        namespace\n        key\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": {return: RegisterVariantFilterDefinitionMutation, variables: RegisterVariantFilterDefinitionMutationVariables},
  "#graphql\n  mutation SetVariantFilterRule($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      metafields {\n        id\n        namespace\n        key\n        value\n      }\n      userErrors {\n        field\n        message\n        code\n      }\n    }\n  }\n": {return: SetVariantFilterRuleMutation, variables: SetVariantFilterRuleMutationVariables},
  "#graphql\n  mutation DeleteVariantFilterRule($metafields: [MetafieldIdentifierInput!]!) {\n    metafieldsDelete(metafields: $metafields) {\n      deletedMetafields {\n        ownerId\n        namespace\n        key\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: DeleteVariantFilterRuleMutation, variables: DeleteVariantFilterRuleMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
