import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "~/shopify.server";

// Catch-all for all /auth/* paths (OAuth install, /auth/callback,
// /auth/shopify/callback, etc.). The Shopify library handles the full
// OAuth flow when authenticate.admin() is called here.
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await authenticate(request, context);
  return null;
};

// Ensure Shopify's reauth/redirect headers survive on thrown responses.
export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
