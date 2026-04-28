import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { registerMetafieldDefinition } from "~/graphql/metafields.server";
import type { AppLoadContext } from "@remix-run/cloudflare";
import type { Env } from "../server";

let shopify: ReturnType<typeof shopifyApp> | null = null;
// Kept separate so we can refresh the KV namespace binding on every request.
// Cloudflare Workers bindings are scoped to a single invocation and must not be
// reused across requests — stale bindings cause silent read/write failures.
let kvStorage: KVSessionStorage | null = null;

function createShopify(env: Env) {
  kvStorage = new KVSessionStorage(env.SESSION_KV);
  return shopifyApp({
    apiKey: env.SHOPIFY_API_KEY,
    apiSecretKey: env.SHOPIFY_API_SECRET,
    appUrl: env.SHOPIFY_APP_URL,
    scopes: ["read_products", "write_products"],
    apiVersion: "2025-04" as any,
    // Cast: `@shopify/shopify-app-remix` and the KV session-storage package
    // resolve `@shopify/shopify-api` from different paths, which TS treats as
    // structurally incompatible. The runtime shape is identical.
    sessionStorage: kvStorage as any,
    hooks: {
      afterAuth: async ({ session, admin }) => {
        shopify!.registerWebhooks({ session }).catch((err: unknown) => {
          console.error("[variant-filter] registerWebhooks failed:", err);
        });
        try {
          // The real admin client has a richer signature than what the helper
          // expects; cast to the minimal shape `registerMetafieldDefinition`
          // uses (it only calls `graphql(query, { variables })`).
          await registerMetafieldDefinition(admin as never);
        } catch (err) {
          console.error("[variant-filter] registerMetafieldDefinition failed:", err);
        }
      },
    },
    future: { unstable_newEmbeddedAuthStrategy: true },
  });
}

export function getShopify(env: Env) {
  if (!shopify) {
    shopify = createShopify(env);
  } else {
    // Refresh the KV namespace to this request's binding so KV reads/writes
    // use a live binding rather than one from a prior invocation.
    kvStorage!.setNamespace(env.SESSION_KV);
  }
  return shopify;
}

export async function authenticate(
  request: Request,
  context: AppLoadContext
) {
  return getShopify(context.env).authenticate.admin(request);
}

export async function login(request: Request, context: AppLoadContext) {
  return getShopify(context.env).login(request);
}
