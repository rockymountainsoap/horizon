import { useState } from "react";
import { json, redirect } from "@remix-run/cloudflare";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Modal,
  Page,
  PageActions,
  Text,
} from "@shopify/polaris";
import { RuleEditor } from "~/components/RuleEditor";
import {
  GET_COLLECTION_WITH_RULE,
  GET_PRODUCT_OPTIONS,
} from "~/graphql/collections.server";
import {
  DELETE_RULE,
  METAFIELD_KEY,
  METAFIELD_NAMESPACE,
  SET_RULE,
} from "~/graphql/metafields.server";
import { FilterRuleSchema, parseRule } from "~/models/rule.server";
import { authenticate } from "~/shopify.server";

interface CollectionResponse {
  data?: {
    collection: {
      id: string;
      title: string;
      handle: string;
      metafield: { id: string; value: string } | null;
    } | null;
  };
}

interface ProductOptionsResponse {
  data?: {
    products: {
      edges: Array<{ node: { options: Array<{ name: string }> } }>;
    };
  };
}

interface SetMetafieldsResponse {
  data?: {
    metafieldsSet: {
      metafields: Array<{ id: string }>;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  };
}

interface DeleteMetafieldsResponse {
  data?: {
    metafieldsDelete: {
      deletedMetafields: Array<{ ownerId: string }> | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  };
}

type ActionResult =
  | { success: true; errors: Record<string, never> }
  | { success: false; errors: Record<string, string[]> };

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const gid = `gid://shopify/Collection/${params.id}`;

  const [collectionRes, optionsRes] = await Promise.all([
    admin.graphql(GET_COLLECTION_WITH_RULE, { variables: { id: gid } }),
    admin.graphql(GET_PRODUCT_OPTIONS, { variables: { first: 50 } }),
  ]);

  const { data: colData } = (await collectionRes.json()) as CollectionResponse;
  const { data: optData } = (await optionsRes.json()) as ProductOptionsResponse;

  if (!colData?.collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  const optionNames: string[] = Array.from(
    new Set<string>(
      optData?.products?.edges?.flatMap(({ node }) =>
        node.options.map((o) => o.name)
      ) ?? []
    )
  );

  return json({
    collection: {
      id: colData.collection.id,
      title: colData.collection.title,
      metafieldId: colData.collection.metafield?.id ?? null,
      rule: parseRule(colData.collection.metafield?.value),
    },
    optionNames,
  });
}

export async function action({
  request,
  context,
  params,
}: ActionFunctionArgs): Promise<Response> {
  const { admin } = await authenticate(request, context);
  const gid = `gid://shopify/Collection/${params.id}`;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");

  if (intent === "clear") {
    try {
      const res = await admin.graphql(DELETE_RULE, {
        variables: {
          metafields: [
            { ownerId: gid, namespace: METAFIELD_NAMESPACE, key: METAFIELD_KEY },
          ],
        },
      });
      const { data } = (await res.json()) as DeleteMetafieldsResponse;
      const errs = data?.metafieldsDelete?.userErrors ?? [];
      if (errs.length > 0) {
        return json<ActionResult>({
          success: false,
          errors: { api: [errs[0].message] },
        });
      }
      return redirect("/app");
    } catch (err) {
      console.error("[variant-filter] clear failed:", err);
      return json<ActionResult>({
        success: false,
        errors: { api: ["Could not reach Shopify to clear the rule."] },
      });
    }
  }

  // intent === 'save'
  const raw = {
    filterType: form.get("filterType"),
    option: form.get("option"),
    label: form.get("label"),
    values: (() => {
      try {
        return JSON.parse(String(form.get("values") || "[]"));
      } catch {
        return [];
      }
    })(),
    maxMl: form.get("maxMl") ?? undefined,
  };

  const parsed = FilterRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return json<ActionResult>({
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  try {
    const res = await admin.graphql(SET_RULE, {
      variables: {
        metafields: [
          {
            ownerId: gid,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(parsed.data),
          },
        ],
      },
    });
    const { data } = (await res.json()) as SetMetafieldsResponse;
    const apiErrors = data?.metafieldsSet?.userErrors ?? [];

    if (apiErrors.length > 0) {
      return json<ActionResult>({
        success: false,
        errors: { api: apiErrors.map((e) => e.message) },
      });
    }

    return json<ActionResult>({ success: true, errors: {} });
  } catch (err) {
    console.error("[variant-filter] save failed:", err);
    return json<ActionResult>({
      success: false,
      errors: { api: ["Could not reach Shopify to save the rule."] },
    });
  }
}

export default function CollectionEditor() {
  const { collection, optionNames } = useLoaderData<typeof loader>();
  // `useActionData` infers a union that includes `Response` (from `redirect`).
  // Redirects don't surface as actionData on the next render, so cast to the
  // narrower shape that's actually returned to the component.
  const actionData = useActionData() as ActionResult | undefined;
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSaving = navigation.formData?.get("intent") === "save";
  const isClearing = navigation.formData?.get("intent") === "clear";

  const [confirmClear, setConfirmClear] = useState(false);

  const apiError =
    actionData && !actionData.success ? actionData.errors.api?.[0] : undefined;

  function performClear() {
    submit({ intent: "clear" }, { method: "POST" });
    setConfirmClear(false);
  }

  return (
    <Page
      title={collection.title}
      backAction={{ content: "Collections", url: "/app" }}
    >
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success" title="Rule saved">
            <p>Shoppers on this collection will now see only matching variants.</p>
          </Banner>
        )}

        {apiError && (
          <Banner tone="critical" title="Could not save rule">
            <p>{apiError}</p>
          </Banner>
        )}

        <Form method="post">
          <input type="hidden" name="intent" value="save" />
          <Card>
            <RuleEditor
              defaultValues={collection.rule}
              optionNames={optionNames}
              errors={
                actionData && !actionData.success ? actionData.errors : {}
              }
            />
          </Card>

          <PageActions
            primaryAction={
              <Button variant="primary" submit loading={isSaving}>
                Save rule
              </Button>
            }
            secondaryActions={
              collection.metafieldId
                ? [
                    {
                      content: "Clear rule",
                      destructive: true,
                      loading: isClearing,
                      onAction: () => setConfirmClear(true),
                    },
                  ]
                : []
            }
          />
        </Form>
      </BlockStack>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear variant filter rule?"
        primaryAction={{
          content: "Clear rule",
          destructive: true,
          onAction: performClear,
          loading: isClearing,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setConfirmClear(false) },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Shoppers visiting{" "}
            <Text as="span" fontWeight="semibold">
              {collection.title}
            </Text>{" "}
            will see all variants again. You can set a new rule at any time.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
