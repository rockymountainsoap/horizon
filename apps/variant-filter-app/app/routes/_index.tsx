import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (url.pathname === "/") {
    // Forward shop/host/session params — Shopify auth relies on them to detect
    // the embedded context and perform token exchange.
    const qs = url.searchParams.toString();
    return redirect(`/app${qs ? `?${qs}` : ""}`);
  }
  return null;
}
