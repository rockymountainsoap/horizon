import { useState } from "react";
import { redirect } from "react-router";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
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
  GET_COLLECTION_PRODUCT_OPTIONS,
  GET_COLLECTION_WITH_RULE,
} from "~/graphql/collections.server";
import {
  DELETE_RULE,
  METAFIELD_KEY,
  METAFIELD_NAMESPACE,
  SET_RULE,
} from "~/graphql/metafields.server";
import { FilterRuleSchema, parseRule } from "~/models/rule.server";
import { authenticate } from "~/shopify.server";

type ActionResult =
  | { success: true; errors: Record<string, never> }
  | { success: false; errors: Record<string, string[]> };

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const gid = `gid://shopify/Collection/${params.id}`;

  const optionNameSet = new Set<string>();
  const fetchOptionsPage = (after?: string) =>
    admin.graphql(GET_COLLECTION_PRODUCT_OPTIONS, {
      variables: { id: gid, first: 250, after },
    });

  const [collectionRes, firstOptionsRes] = await Promise.all([
    admin.graphql(GET_COLLECTION_WITH_RULE, { variables: { id: gid } }),
    fetchOptionsPage(),
  ]);

  const { data: colData } = await collectionRes.json();

  if (!colData?.collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  // Walk the collection's products (up to 4 pages × 250) so every option
  // name in the collection is offered, not just a first-page sample.
  let optionsRes = firstOptionsRes;
  for (let page = 0; page < 4; page++) {
    const { data: optData } = await optionsRes.json();
    const products = optData?.collection?.products;
    if (!products) break;
    for (const node of products.nodes) {
      for (const option of node.options) {
        optionNameSet.add(option.name);
      }
    }
    if (
      page === 3 ||
      !products.pageInfo.hasNextPage ||
      !products.pageInfo.endCursor
    ) {
      break;
    }
    optionsRes = await fetchOptionsPage(products.pageInfo.endCursor);
  }

  const optionNames = Array.from(optionNameSet);

  return {
    collection: {
      id: colData.collection.id,
      title: colData.collection.title,
      metafieldId: colData.collection.metafield?.id ?? null,
      rule: parseRule(colData.collection.metafield?.value),
    },
    optionNames,
  };
}

// Ensure Shopify's reauth/CSP headers survive on responses thrown by
// authenticate().
export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);

export async function action({ request, context, params }: ActionFunctionArgs) {
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
      const { data } = await res.json();
      const errs = data?.metafieldsDelete?.userErrors ?? [];
      if (errs.length > 0) {
        return {
          success: false,
          errors: { api: [errs[0].message] },
        } satisfies ActionResult;
      }
      return redirect("/app");
    } catch (err) {
      console.error("[variant-filter] clear failed:", err);
      return {
        success: false,
        errors: { api: ["Could not reach Shopify to clear the rule."] },
      } satisfies ActionResult;
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
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    } satisfies ActionResult;
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
    const { data } = await res.json();
    const apiErrors = data?.metafieldsSet?.userErrors ?? [];

    if (apiErrors.length > 0) {
      return {
        success: false,
        errors: { api: apiErrors.map((e) => e.message) },
      } satisfies ActionResult;
    }

    return { success: true, errors: {} } satisfies ActionResult;
  } catch (err) {
    console.error("[variant-filter] save failed:", err);
    return {
      success: false,
      errors: { api: ["Could not reach Shopify to save the rule."] },
    } satisfies ActionResult;
  }
}

export default function CollectionEditor() {
  const { collection, optionNames } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
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
