import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { authenticate } from "~/shopify.server";

// Catch-all for all /auth/* paths (OAuth install, /auth/callback,
// /auth/shopify/callback, etc.). The Shopify library handles the full
// OAuth flow when authenticate.admin() is called here.
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await authenticate(request, context);
  return null;
};
