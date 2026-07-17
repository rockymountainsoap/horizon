import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
// The React Router AppProvider only wires up App Bridge (and the Polaris
// web-components script) — unlike the old Remix package it no longer wraps
// Polaris React, so we nest Polaris's own provider for the component library.
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "~/shopify.server";

interface PolarisLinkProps extends React.HTMLProps<HTMLAnchorElement> {
  url: string;
  external?: boolean;
}

// Bridge Polaris `url` props (Button, Pagination, backAction, …) to React
// Router's client-side navigation. Without this, Polaris renders plain
// anchors whose document navigations drop the embedded auth params and
// dead-end the session-token flow. The old shopify-app-remix AppProvider
// did this wiring internally.
function PolarisRouterLink({
  url,
  children,
  external,
  ref: _ref,
  ...rest
}: PolarisLinkProps) {
  if (external) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={url} {...rest}>
      {children}
    </Link>
  );
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  await authenticate(request, context);
  return { apiKey: context.cloudflare.env.SHOPIFY_API_KEY };
}

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider
        i18n={polarisTranslations}
        linkComponent={PolarisRouterLink}
      >
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch thrown responses from authenticate()
// so their headers (reauth, CSP) are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
