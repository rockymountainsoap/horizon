import { json } from "@remix-run/cloudflare";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  Link,
} from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Pagination,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { RuleBadge } from "~/components/RuleBadge";
import { LIST_COLLECTIONS } from "~/graphql/collections.server";
import { DELETE_RULE } from "~/graphql/metafields.server";
import { parseRule } from "~/models/rule.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { admin } = await authenticate(request, context);

  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? undefined;
  const before = url.searchParams.get("before") ?? undefined;

  const response = await admin.graphql(LIST_COLLECTIONS, {
    variables: { first: 50, after, before },
  });
  const { data } = (await response.json()) as any;

  return json({
    collections: data.collections.edges.map(({ node }: any) => ({
      id: node.id as string,
      numericId: (node.id as string).split("/").at(-1)!,
      title: node.title as string,
      handle: node.handle as string,
      imageUrl: (node.image?.url as string) ?? null,
      imageAlt: (node.image?.altText as string) ?? (node.title as string),
      metafieldId: (node.metafield?.id as string) ?? null,
      rule: parseRule(node.metafield?.value),
    })),
    pageInfo: data.collections.pageInfo as {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string;
      endCursor: string;
    },
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { admin } = await authenticate(request, context);
  const form = await request.formData();
  const metafieldId = String(form.get("metafieldId"));

  await admin.graphql(DELETE_RULE, { variables: { metafieldId } });
  return json({ cleared: true });
}

export default function CollectionsIndex() {
  const { collections, pageInfo } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  function handleClear(metafieldId: string) {
    if (confirm("Clear this rule? All variants will be shown again.")) {
      submit({ metafieldId }, { method: "POST" });
    }
  }

  const resourceName = { singular: "collection", plural: "collections" };

  return (
    <Page title="Variant Filter Rules">
      <BlockStack gap="400">
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
              loading={isLoading}
              headings={[
                { title: "" },
                { title: "Collection" },
                { title: "Active rule" },
                { title: "" },
              ]}
            >
              {collections.map((col, index) => (
                <IndexTable.Row key={col.id} id={col.id} position={index}>
                  <IndexTable.Cell>
                    <Thumbnail
                      source={col.imageUrl ?? ""}
                      alt={col.imageAlt}
                      size="small"
                    />
                  </IndexTable.Cell>

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
                          onClick={() => handleClear(col.metafieldId!)}
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
    </Page>
  );
}
