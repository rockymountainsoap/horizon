import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { getShopify } from "~/shopify.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const { topic, shop } = await getShopify(context.env).authenticate.webhook(
    request
  );

  switch (topic) {
    case "APP_UNINSTALLED":
      console.log(`[variant-filter] App uninstalled from ${shop}`);
      break;
    default:
      console.warn(`[variant-filter] Unhandled webhook topic: ${topic}`);
  }

  return new Response("OK", { status: 200 });
}
