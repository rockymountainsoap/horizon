import { json, redirect } from "@remix-run/cloudflare";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Divider,
  InlineStack,
  Page,
  PageActions,
  Text,
} from "@shopify/polaris";
import { RuleEditor } from "~/components/RuleEditor";
import {
  GET_COLLECTION_WITH_RULE,
  GET_PRODUCT_OPTIONS,
} from "~/graphql/collections.server";
import { DELETE_RULE, SET_RULE } from "~/graphql/metafields.server";
import { FilterRuleSchema, parseRule } from "~/models/rule.server";
import { authenticate } from "~/shopify.server";

const NAMESPACE = "variant-filter";
const KEY = "rule";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const gid = `gid://shopify/Collection/${params.id}`;

  const [collectionRes, optionsRes] = await Promise.all([
    admin.graphql(GET_COLLECTION_WITH_RULE, { variables: { id: gid } }),
    admin.graphql(GET_PRODUCT_OPTIONS, { variables: { first: 50 } }),
  ]);

  const { data: colData } = (await collectionRes.json()) as any;
  const { data: optData } = (await optionsRes.json()) as any;

  if (!colData?.collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  const optionNames: string[] = Array.from(
    new Set<string>(
      optData?.products?.edges?.flatMap(({ node }: any) =>
        node.options.map((o: any) => o.name as string)
      ) ?? []
    )
  );

  return json({
    collection: {
      id: colData.collection.id as string,
      title: colData.collection.title as string,
      metafieldId: (colData.collection.metafield?.id as string) ?? null,
      rule: parseRule(colData.collection.metafield?.value),
    },
    optionNames,
  });
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const gid = `gid://shopify/Collection/${params.id}`;
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "clear") {
    const metafieldId = String(form.get("metafieldId"));
    const res = await admin.graphql(DELETE_RULE, { variables: { metafieldId } });
    const { data } = (await res.json()) as any;
    const errs = data?.metafieldDelete?.userErrors ?? [];
    if (errs.length > 0) {
      return json({ success: false, errors: { api: [errs[0].message] } });
    }
    return redirect("/app");
  }

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
    return json({
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const res = await admin.graphql(SET_RULE, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: NAMESPACE,
          key: KEY,
          type: "json",
          value: JSON.stringify(parsed.data),
        },
      ],
    },
  });
  const { data } = (await res.json()) as any;
  const apiErrors: { message: string }[] =
    data?.metafieldsSet?.userErrors ?? [];

  if (apiErrors.length > 0) {
    return json({
      success: false,
      errors: { api: apiErrors.map((e) => e.message) },
    });
  }

  return json({ success: true, errors: {} });
}

export default function CollectionEditor() {
  const { collection, optionNames } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.formData?.get("intent") === "save";
  const isClearing = navigation.formData?.get("intent") === "clear";

  const apiError =
    actionData && !actionData.success
      ? (actionData.errors as any)?.api?.[0]
      : undefined;

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
                actionData && !actionData.success
                  ? (actionData.errors as Record<string, string[]>)
                  : {}
              }
            />
          </Card>

          <PageActions
            primaryAction={
              <Button
                variant="primary"
                submit
                loading={isSaving}
              >
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
                      onAction: () => {
                        const f = document.createElement("form");
                        f.method = "post";
                        f.innerHTML = `
                          <input name="intent" value="clear" />
                          <input name="metafieldId" value="${collection.metafieldId}" />
                        `;
                        document.body.appendChild(f);
                        f.submit();
                      },
                    },
                  ]
                : []
            }
          />
        </Form>
      </BlockStack>
    </Page>
  );
}
