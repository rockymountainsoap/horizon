# Workers

Edge workers that are **not** part of the Shopify app package live here so the repo stays a clear monolith:

| Path | Role |
|------|------|
| `native_worker/` | Cloudflare Worker — wishlist API behind Shopify App Proxy (`native_worker.js` entry) |

The Horizon theme at repo root does not use this folder.
