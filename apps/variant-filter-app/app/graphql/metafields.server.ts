import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
// Type-only imports — the generated file declares TS enums that don't exist at
// runtime, so enum members are referenced via literal casts below.
import type {
  MetafieldDefinitionCreateUserErrorCode,
  MetafieldDefinitionInput,
  MetafieldOwnerType,
  MetafieldStorefrontAccessInput,
} from "~/types/admin.types";

export const REGISTER_DEFINITION = `#graphql
  mutation RegisterVariantFilterDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        namespace
        key
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const DEFINITION_INPUT: MetafieldDefinitionInput = {
  namespace: "variant-filter",
  key: "rule",
  name: "Variant Filter Rule",
  description:
    "Defines which product variant option values to display in this collection. Managed by the Variant Filter app — do not edit manually.",
  type: "json",
  ownerType: "COLLECTION" as MetafieldOwnerType,
  access: { storefront: "PUBLIC_READ" as MetafieldStorefrontAccessInput },
};

export async function registerMetafieldDefinition(
  admin: AdminApiContext
): Promise<void> {
  const response = await admin.graphql(REGISTER_DEFINITION, {
    variables: { definition: DEFINITION_INPUT },
  });
  const { data } = await response.json();
  const errors = data?.metafieldDefinitionCreate?.userErrors ?? [];

  for (const error of errors) {
    // TAKEN = a definition already exists for this namespace+key;
    // UNSTRUCTURED_ALREADY_EXISTS = metafield values already exist without a
    // formal definition (replaced the pre-2026 ALREADY_EXISTS code).
    // Both mean a usable definition is in place — safe to continue.
    if (
      error.code === ("TAKEN" as MetafieldDefinitionCreateUserErrorCode) ||
      error.code ===
        ("UNSTRUCTURED_ALREADY_EXISTS" as MetafieldDefinitionCreateUserErrorCode)
    ) {
      console.log(`[variant-filter] Metafield definition already in place (${error.code}) — skipping.`);
      return;
    }
    console.error(
      `[variant-filter] Metafield definition error: ${error.code} — ${error.message}`
    );
    throw new Error(error.code ?? "UNKNOWN_ERROR");
  }

  const created = data?.metafieldDefinitionCreate?.createdDefinition;
  if (created) {
    console.log(`[variant-filter] Metafield definition registered: ${created.id}`);
  }
}

export const SET_RULE = `#graphql
  mutation SetVariantFilterRule($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

// Uses `metafieldsDelete` (plural) — the singular `metafieldDelete` was
// removed from the Admin API in 2025-01. Identifies the metafield by
// owner + namespace + key rather than GID.
export const DELETE_RULE = `#graphql
  mutation DeleteVariantFilterRule($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields {
        ownerId
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const METAFIELD_NAMESPACE = "variant-filter";
export const METAFIELD_KEY = "rule";
