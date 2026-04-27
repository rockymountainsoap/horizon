// Worker entry point — built by Wrangler after `npm run build` produces the Remix bundle.
// Import the Remix SSR bundle produced by Vite, not the virtual:remix/server-build module
// (that virtual is only resolvable inside Vite's own dev/build pipeline).
import * as build from "./build/server/index.js";
import { createRequestHandler } from "@remix-run/cloudflare";
import {
  getAssetFromKV,
  NotFoundError,
  MethodNotAllowedError,
} from "@cloudflare/kv-asset-handler";
// Injected by Wrangler's [site] feature — maps URL paths to hashed KV keys.
// @ts-ignore
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifestJSON);
const handleRequest = createRequestHandler(build as any);

export interface Env {
  SESSION_KV: KVNamespace;
  __STATIC_CONTENT: KVNamespace;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Serve client-side assets from the KV store uploaded by Wrangler's [site] feature.
    // Only intercept /assets/* to let Remix handle all other paths (including auth, routes, etc).
    if (new URL(request.url).pathname.startsWith("/assets/")) {
      try {
        return await getAssetFromKV(
          { request, waitUntil: ctx.waitUntil.bind(ctx) },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        );
      } catch (e) {
        if (!(e instanceof NotFoundError) && !(e instanceof MethodNotAllowedError)) {
          throw e;
        }
      }
    }

    return handleRequest(request, { env, ctx });
  },
};
