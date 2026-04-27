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

const DEFINITION_INPUT = {
  namespace: "variant-filter",
  key: "rule",
  name: "Variant Filter Rule",
  description:
    "Defines which product variant option values to display in this collection. Managed by the Variant Filter app — do not edit manually.",
  type: "json",
  ownerType: "COLLECTION",
  access: { storefront: "PUBLIC_READ" },
};

export async function registerMetafieldDefinition(admin: {
  graphql: (query: string, options?: { variables?: unknown }) => Promise<Response>;
}): Promise<void> {
  const response = await admin.graphql(REGISTER_DEFINITION, {
    variables: { definition: DEFINITION_INPUT },
  });
  const { data } = (await response.json()) as any;
  const errors: { code: string; message: string }[] =
    data?.metafieldDefinitionCreate?.userErrors ?? [];

  for (const error of errors) {
    // ALREADY_EXISTS = definition was registered previously; TAKEN = metafield
    // values already exist for this namespace+key without a formal definition.
    // Both mean a usable definition is in place — safe to continue.
    if (error.code === "ALREADY_EXISTS" || error.code === "TAKEN") {
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

export const DELETE_RULE = `#graphql
  mutation DeleteVariantFilterRule($metafieldId: ID!) {
    metafieldDelete(input: { id: $metafieldId }) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;
