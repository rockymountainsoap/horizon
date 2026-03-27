# native_worker — Cloudflare Worker (wishlist API)

**Entry:** `native_worker.js` (re-exports `src/index.js`) — configured in `wrangler.toml` as `main`.

Implements the WS0 wishlist API routes, served behind Shopify's App Proxy with HMAC verification. Admin API access tokens are acquired automatically via the **Shopify Client Credentials Grant** (OAuth 2.0 §4.4) — no manual install step required.

## Routes

| Method | Path (suffix) | Auth | Description |
|--------|----------------|------|-------------|
| GET | `/wishlist/list` | Customer | Current wishlist GIDs |
| POST | `/wishlist/add` | Customer | Body: `{ "productGid" }` |
| POST | `/wishlist/remove` | Customer | Body: `{ "productGid" }` |
| POST | `/wishlist/merge` | Customer | Body: `{ "local": ["gid://..."] }` |
| GET | `/wishlist/products` | Any | Query: `?ids=gid://...` — product details for drawer |
| GET | `/wishlist/health` or `/health` | None | Liveness check |
| GET | `/` | None | Status page |

## Setup (one-time)

### 1. Create KV namespace

```bash
wrangler kv namespace create APP_KV
```

Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]`.

### 2. Set the client secret

```bash
wrangler secret put SHOPIFY_CLIENT_SECRET
# Paste the app client secret from the Dev Dashboard
```

This secret is used for both:
- **App Proxy HMAC verification** — Shopify signs every proxied request with this secret
- **Client Credentials Grant** — exchanged (with `SHOPIFY_CLIENT_ID`) for a 24h Admin API token

### 3. Configure vars

In `wrangler.toml`, set:
- `SHOPIFY_CLIENT_ID` — the app's Client ID from the Dev Dashboard
- `SHOP_DOMAIN` — the store's `.myshopify.com` hostname

### 4. Deploy

```bash
npx wrangler deploy
```

That's it. No OAuth consent screen, no manual install visit, no redirect URLs to configure. The Worker automatically acquires and refreshes Admin API tokens.

## Authentication — how it works

The Worker uses the **Client Credentials Grant** ([Shopify docs](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)):

1. On the first request (or when the cached token expires), the Worker POSTs to `https://{shop}/admin/oauth/access_token` with `grant_type=client_credentials`, `client_id`, and `client_secret`.
2. Shopify returns an `access_token` valid for **24 hours**.
3. The Worker caches the token in two layers:
   - **In-memory** — survives across requests within the same Worker isolate (sub-ms)
   - **KV** — survives cold starts and Worker re-deployments (~10ms)
4. The cached token TTL is 23 hours (1 hour buffer before Shopify's 24h expiry).
5. When the cache expires, the Worker transparently requests a fresh token.

**Requirements:**
- The app and store must be in the **same Shopify organization**
- The app must be **installed** on the store (via Dev Dashboard or Shopify CLI)
- Access scopes must be configured in the app's TOML file

**Key advantage over the old OAuth flow:** Tokens are never "lost" — even if KV is cleared or a cold start occurs, the Worker self-heals by requesting a fresh token on the next request. No manual intervention needed.

## Token resolution

`getAdminToken(env, shop)` resolves tokens in priority order:
1. **In-memory cache** — same isolate, zero-latency
2. **KV cache** — `cc_access_token` key, cross-isolate durable cache
3. **Fresh token** — Client Credentials Grant to Shopify

## File structure

```
src/
├── config.js              # Shared constants (API version, cache TTL)
├── index.js               # Entry point, router
├── handlers/
│   ├── add.js             # POST /wishlist/add
│   ├── remove.js          # POST /wishlist/remove
│   ├── list.js            # GET  /wishlist/list
│   ├── merge.js           # POST /wishlist/merge
│   └── products.js        # GET  /wishlist/products
├── middleware/
│   ├── hmac.js            # HMAC verification (App Proxy)
│   ├── security.js        # withSecurity() middleware chain
│   └── validate.js        # Input validators
├── shopify/
│   ├── adminApi.js        # Admin GraphQL helpers (getWishlist, setWishlist)
│   └── tokens.js          # Client Credentials token acquisition + caching
└── utils/
    ├── errors.js          # AuthError, ValidationError, RateLimitError
    └── response.js        # CORS, security headers, JSON responses
```

## Optional features

- **NONCE_KV**: Replay protection for App Proxy requests. Create with `wrangler kv namespace create NONCE_KV`.
- **Rate limiting**: Uncomment `[[unsafe.bindings]]` in `wrangler.toml` (requires paid Cloudflare plan).

## Environment-specific deployment

```bash
npx wrangler deploy                    # default (development)
npx wrangler deploy --env production   # production worker
npx wrangler deploy --env staging      # staging worker
```

Production needs its own KV namespace — create with `wrangler kv namespace create APP_KV --env production` and add the ID to `wrangler.toml` under `[env.production]`.

## Scripts

```bash
npm install
npm run dev      # wrangler dev (local)
npm run deploy   # wrangler deploy
npm test         # vitest
```

## Reference

Architecture plan: `.cursor/plans/WS0-native-wishlist.md`
