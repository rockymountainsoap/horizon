# native_worker — Cloudflare Worker (wishlist API)

**Entry:** `native_worker.js` (re-exports `src/index.js`) — configured in `wrangler.toml` as `main`.

Implements WS0 App Proxy routes (HMAC, optional KV nonce + rate limits, Admin GraphQL metafield read/write):

| Method | Path (suffix) | Role |
|--------|----------------|------|
| GET | `/wishlist/list` | Current wishlist GIDs |
| POST | `/wishlist/add` | Body: `{ "productGid" }` |
| POST | `/wishlist/remove` | Body: `{ "productGid" }` |
| POST | `/wishlist/merge` | Body: `{ "local": ["gid://..."] }` |
| GET | `/wishlist/health` or `/health` | Liveness |

## Setup

1. Uncomment and fill **`[[kv_namespaces]]`** in `wrangler.toml` after `wrangler kv namespace create NONCE_KV`.
2. Set **`SHOP_DOMAIN`** and **`SHOP_MYSHOPIFY_DOMAIN`** `[vars]` to your storefront.
3. Optional: uncomment **`[[unsafe.bindings]]`** rate limits (paid Cloudflare feature). Without them, the worker skips IP/customer rate limiting.
4. Secrets:

   ```bash
   wrangler secret put SHOPIFY_ADMIN_TOKEN
   wrangler secret put SHOPIFY_PROXY_SECRET
   wrangler secret put SHOPIFY_STOREFRONT_TOKEN
   ```

   `SHOPIFY_STOREFRONT_TOKEN` is reserved for future use (e.g. extension CORS); the worker currently uses the Admin token only.

5. Local dev: optional `.dev.vars` (git-ignored) with the same keys.

## Scripts

```bash
npm install
npm run dev      # wrangler dev
npm run deploy   # wrangler deploy
npm test         # vitest
```

## Reference

`.cursor/plans/WS0-native-wishlist.md`
