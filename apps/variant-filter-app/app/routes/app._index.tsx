import { useState } from "react";
import { data } from "react-router";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Link,
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
  EmptyState,
  IndexTable,
  InlineStack,
  Modal,
  Page,
  Pagination,
  Text,
} from "@shopify/polaris";
import { RuleBadge } from "~/components/RuleBadge";
import { LIST_COLLECTIONS } from "~/graphql/collections.server";
import {
  DELETE_RULE,
  METAFIELD_KEY,
  METAFIELD_NAMESPACE,
} from "~/graphql/metafields.server";
import { parseRule } from "~/models/rule.server";
import { authenticate } from "~/shopify.server";

interface CollectionRow {
  id: string;
  numericId: string;
  title: string;
  metafieldId: string | null;
  rule: ReturnType<typeof parseRule>;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { admin } = await authenticate(request, context);

  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? undefined;
  const before = url.searchParams.get("before") ?? undefined;

  const response = await admin.graphql(LIST_COLLECTIONS, {
    variables: { first: 50, after, before },
  });
  const { data } = await response.json();

  if (!data) {
    throw new Response("Failed to load collections", { status: 502 });
  }

  const collections: CollectionRow[] = data.collections.edges.map(
    ({ node }) => ({
      id: node.id,
      numericId: node.id.split("/").at(-1) ?? node.id,
      title: node.title,
      metafieldId: node.metafield?.id ?? null,
      rule: parseRule(node.metafield?.value),
    })
  );

  return { collections, pageInfo: data.collections.pageInfo };
}

// Ensure Shopify's reauth/CSP headers survive on responses thrown by
// authenticate().
export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);

type ActionResult = { ok: true } | { ok: false; error: string };

export async function action({ request, context }: ActionFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const form = await request.formData();
  const ownerId = String(form.get("ownerId") ?? "");

  if (!ownerId.startsWith("gid://shopify/Collection/")) {
    return data<ActionResult>(
      { ok: false, error: "Missing or invalid collection identifier." },
      { status: 400 }
    );
  }

  try {
    const res = await admin.graphql(DELETE_RULE, {
      variables: {
        metafields: [
          { ownerId, namespace: METAFIELD_NAMESPACE, key: METAFIELD_KEY },
        ],
      },
    });
    const { data: resData } = await res.json();
    const userErrors = resData?.metafieldsDelete?.userErrors ?? [];

    if (userErrors.length > 0) {
      return data<ActionResult>(
        { ok: false, error: userErrors[0].message },
        { status: 400 }
      );
    }

    return data<ActionResult>({ ok: true });
  } catch (err) {
    console.error("[variant-filter] DELETE_RULE failed:", err);
    return data<ActionResult>(
      { ok: false, error: "Could not reach Shopify to clear the rule." },
      { status: 502 }
    );
  }
}

export default function CollectionsIndex() {
  const { collections, pageInfo } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isClearing = navigation.formMethod === "POST";

  const [pendingClear, setPendingClear] = useState<CollectionRow | null>(null);

  function confirmClear() {
    if (!pendingClear) return;
    submit({ ownerId: pendingClear.id }, { method: "POST" });
    setPendingClear(null);
  }

  const resourceName = { singular: "collection", plural: "collections" };
  const errorBanner =
    actionData && !actionData.ok ? actionData.error : undefined;
  const successBanner =
    actionData?.ok === true && navigation.state === "idle";

  return (
    <Page title="Variant Filter Rules">
      <BlockStack gap="400">
        {successBanner && (
          <Banner tone="success" onDismiss={() => undefined}>
            Rule cleared. All variants will be shown again on that collection.
          </Banner>
        )}

        {errorBanner && (
          <Banner tone="critical" title="Could not clear rule">
            <p>{errorBanner}</p>
          </Banner>
        )}

        <Card padding="0">
          {collections.length === 0 ? (
            <EmptyState
              heading="No collections yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Collections will appear here once your store has some.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={resourceName}
              itemCount={collections.length}
              selectable={false}
              loading={isClearing}
              headings={[
                { title: "Collection" },
                { title: "Active rule" },
                { title: "" },
              ]}
            >
              {collections.map((col, index) => (
                <IndexTable.Row key={col.id} id={col.id} position={index}>
                  <IndexTable.Cell>
                    <Link to={`/app/collections/${col.numericId}`}>
                      <Text as="span" fontWeight="medium">
                        {col.title}
                      </Text>
                    </Link>
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <RuleBadge rule={col.rule} />
                  </IndexTable.Cell>

                  <IndexTable.Cell>
                    <InlineStack gap="200" align="end">
                      <Button
                        variant="plain"
                        url={`/app/collections/${col.numericId}`}
                      >
                        {col.rule ? "Edit" : "Set rule"}
                      </Button>
                      {col.rule && col.metafieldId && (
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() => setPendingClear(col)}
                        >
                          Clear
                        </Button>
                      )}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={pageInfo.hasPreviousPage}
              previousURL={`?before=${pageInfo.startCursor}`}
              hasNext={pageInfo.hasNextPage}
              nextURL={`?after=${pageInfo.endCursor}`}
            />
          </InlineStack>
        )}
      </BlockStack>

      <Modal
        open={pendingClear !== null}
        onClose={() => setPendingClear(null)}
        title="Clear variant filter rule?"
        primaryAction={{
          content: "Clear rule",
          destructive: true,
          onAction: confirmClear,
          loading: isClearing,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setPendingClear(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Shoppers visiting{" "}
            <Text as="span" fontWeight="semibold">
              {pendingClear?.title}
            </Text>{" "}
            will see all variants again. You can set a new rule at any time.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
