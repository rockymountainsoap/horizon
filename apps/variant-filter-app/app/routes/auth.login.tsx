import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { login } from "~/shopify.server";

// The Shopify library routes /auth/login here and expects shopify.login()
// rather than authenticate.admin(). This renders the shop-domain entry form
// for non-embedded access, and handles POST to kick off OAuth.
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  return login(request, context);
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  return login(request, context);
};
