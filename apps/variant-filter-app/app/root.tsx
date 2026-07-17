import type { LinksFunction } from "react-router";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Top-level error boundary. Without this, any unhandled exception in a loader
 * or action surfaces as React Router's bare "Application Error" string. We render a
 * minimal HTML shell ourselves (Polaris isn't available outside `<AppProvider>`)
 * with enough info for the merchant to recover or report.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let detail =
    "An unexpected error occurred while loading the Variant Filter admin. Try refreshing the page; if the issue persists, contact support.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    detail = typeof error.data === "string" ? error.data : detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{title} — Variant Filter</title>
        <Meta />
        <Links />
      </head>
      <body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: 0,
          padding: "48px 24px",
          background: "#f6f6f7",
          color: "#202223",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #e1e3e5",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 20, marginTop: 0 }}>{title}</h1>
          <p style={{ color: "#6d7175", lineHeight: 1.5 }}>{detail}</p>
          <a
            href="/app"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "8px 16px",
              background: "#202223",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            Back to Variant Filter
          </a>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
