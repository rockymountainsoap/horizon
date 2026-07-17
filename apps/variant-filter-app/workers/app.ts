// Worker entry point. The Cloudflare Vite plugin builds this alongside the
// React Router server bundle and serves `build/client` as Workers Static
// Assets ahead of the worker — no kv-asset-handler / [site] interception.
import { createRequestHandler } from "react-router";

export interface Env {
  SESSION_KV: KVNamespace;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  fetch(request, env, ctx) {
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
