import {
  ApiVersion,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { registerMetafieldDefinition } from "~/graphql/metafields.server";
import type { AppLoadContext } from "react-router";
import type { Env } from "../workers/app";

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
    apiVersion: ApiVersion.July26,
    sessionStorage: kvStorage,
    hooks: {
      // Webhook subscriptions are declared in shopify.app.toml
      // ([[webhooks.subscriptions]]) and synced by `shopify app deploy` —
      // no registerWebhooks call here.
      afterAuth: async ({ admin }) => {
        try {
          await registerMetafieldDefinition(admin);
        } catch (err) {
          console.error(
            "[variant-filter] registerMetafieldDefinition failed:",
            err
          );
        }
      },
    },
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

export async function authenticate(request: Request, context: AppLoadContext) {
  return getShopify(context.cloudflare.env).authenticate.admin(request);
}

export async function login(request: Request, context: AppLoadContext) {
  return getShopify(context.cloudflare.env).login(request);
}
