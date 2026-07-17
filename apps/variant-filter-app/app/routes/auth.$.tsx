import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "~/shopify.server";

// Catch-all for all /auth/* paths (OAuth install, /auth/callback,
// /auth/session-token-bounce, etc.). The Shopify library handles the full
// flow when authenticate.admin() is called here — including THROWING a 200
// Response containing the App Bridge script for the session-token bounce.
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await authenticate(request, context);
  return null;
};

// Required: renders the library's thrown bounce/redirect responses (App
// Bridge script) instead of treating them as errors. Without this the
// session-token bounce page never executes and embedded auth dead-ends.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Ensure Shopify's reauth/redirect headers survive on thrown responses.
export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
