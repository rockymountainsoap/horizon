# locator_worker — Cloudflare Worker (store locator + inventory)

**Entry:** `locator_worker.js` (re-exports `src/index.js`) — configured in `wrangler.toml` as `main`.

Single Worker that serves both Rocky's store-locator UI and per-PDP "find in store" inventory lookups. Mirrors the architecture of `workers/native_worker/`: Client Credentials Grant for Admin API auth, KV-backed token cache, layered handlers, CORS-safe responses.

## Routes

| Method | Path | Auth | Cache (CF edge) | Description |
|--------|------|------|-----------------|-------------|
| GET | `/health` | — | none | Liveness check |
| GET | `/stores` | Admin | `s-maxage=3600, stale-while-revalidate=43200` | Lightweight list of all `store_location` metaobjects |
| GET | `/stores/:handle` | Admin | `s-maxage=3600, stale-while-revalidate=43200` | Full details (hours, description, images, events) |
| GET | `/stores/:handle/email` | Admin | `no-store` | PII-safe email reveal — never cached |
| GET | `/inventory?variantId=<numeric>` | Admin | `s-maxage=300, stale-while-revalidate=3600` | Live per-location inventory for a product variant |
| OPTIONS | `*` | — | — | CORS preflight (204) |

## Setup (one-time)

### 1. Create KV namespace

```bash
cd workers/locator_worker
npx wrangler kv namespace create APP_KV
```

Paste the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.

### 2. Set the client secret

```bash
npx wrangler secret put SHOPIFY_CLIENT_SECRET
# Paste the app client secret from the Shopify Dev Dashboard
```

### 3. Confirm vars in `wrangler.toml`

- `SHOPIFY_CLIENT_ID` — app Client ID from the Dev Dashboard
- `SHOP_DOMAIN` / `SHOP_MYSHOPIFY_DOMAIN` — `.myshopify.com` hostname
- `ALLOWED_ORIGINS` — comma-separated storefront origins permitted to call the Worker

### 4. Deploy

```bash
npx wrangler deploy                  # development
npx wrangler deploy --env production # production (needs its own KV id)
```

## Authentication

Same Client Credentials Grant pattern as `native_worker`. See `workers/native_worker/README.md` for the full explanation. Token cache layers (in-memory → KV → fresh exchange) are identical.

## Metaobject + location dependency

The `/inventory` endpoint returns rows keyed by Shopify `Location` IDs. To join those rows back to display data on the frontend, the `store_location` metaobject must carry a `shopify_location_id` field (single-line text, the trailing numeric segment of `gid://shopify/Location/<id>`). Without that field, frontend display works but the join is brittle.

## File structure

```
src/
├── config.js                 # API version, KV keys, cache TTLs, GraphQL queries
├── index.js                  # Router + CORS preflight + error mapping
├── handlers/
│   ├── stores.js             # GET /stores
│   ├── store.js              # GET /stores/:handle
│   ├── storeEmail.js         # GET /stores/:handle/email
│   └── inventory.js          # GET /inventory
├── middleware/
│   ├── cors.js               # CORS headers + origin allowlist
│   ├── validate.js           # Handle slug + numeric variant ID validators
│   └── validate.test.js
├── shopify/
│   ├── tokens.js             # Client Credentials acquisition + KV caching (verbatim from native_worker)
│   ├── tokens.test.js
│   └── adminApi.js           # GraphQL queries: storeLocations, storeLocation, inventoryByVariant
└── utils/
    ├── errors.js             # AuthError, ValidationError, UpstreamError
    └── response.js           # jsonResponse + secure headers
```

## Scripts

```bash
npm install
npm run dev      # wrangler dev (local)
npm run deploy   # wrangler deploy
npm test         # vitest
```

## Smoke tests

```bash
curl 'http://127.0.0.1:8787/health'
curl 'http://127.0.0.1:8787/stores' | jq '.[] | {handle, name}'
curl 'http://127.0.0.1:8787/stores/banff-banff-avenue' | jq
curl 'http://127.0.0.1:8787/inventory?variantId=44095932465261' | jq
```
