# Agent Plan: Custom Native Product Wishlist
## Rocky Mountain Soap Co. — Shopify Customer Accounts 2.0

**Stack:** Shopify Customer Account UI Extension · Theme App Extension · Cloudflare Workers · Shopify Admin GraphQL API · Customer Metafields  
**Version:** 1.0  
**Status:** Planning

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Environment Setup](#2-prerequisites--environment-setup)
3. [Phase 1 — Shopify App Scaffold](#3-phase-1--shopify-app-scaffold)
4. [Phase 2 — Customer Metafield Definition](#4-phase-2--customer-metafield-definition)
5. [Phase 3 — Cloudflare Worker (Secure API Backend)](#5-phase-3--cloudflare-worker-secure-api-backend)
6. [Phase 4 — Shopify App Proxy Configuration](#6-phase-4--shopify-app-proxy-configuration)
7. [Phase 5 — Theme App Extension (PDP Button)](#7-phase-5--theme-app-extension-pdp-button)
8. [Phase 6 — Customer Account UI Extension (Wishlist Page)](#8-phase-6--customer-account-ui-extension-wishlist-page)
9. [Phase 7 — Guest-to-Account Sync](#9-phase-7--guest-to-account-sync)
10. [Phase 8 — Security Hardening](#10-phase-8--security-hardening)
11. [Phase 9 — Testing & QA](#11-phase-9--testing--qa)
12. [Phase 10 — Deployment & Merchant Setup](#12-phase-10--deployment--merchant-setup)
13. [File & Directory Reference](#13-file--directory-reference)
14. [Environment Variables Reference](#14-environment-variables-reference)
15. [Security Checklist](#15-security-checklist)

---

## 1. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  STOREFRONT (Theme)                                                 │
│                                                                     │
│  PDP / Collection Page                                              │
│  ┌─────────────────────────────────┐                                │
│  │  Theme App Extension            │                                │
│  │  [♥ Save]  data-product-gid=... │                                │
│  └─────────────┬───────────────────┘                                │
│                │ POST /apps/wishlist/add                            │
│                │ (Shopify App Proxy URL)                            │
└────────────────┼────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SHOPIFY APP PROXY                                                  │
│                                                                     │
│  • Receives /apps/wishlist/* requests from storefront               │
│  • Appends ?logged_in_customer_id=<id>&shop=<domain>                │
│  • Signs request with HMAC using app client secret                  │
│  • Forwards to Cloudflare Worker URL                                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLOUDFLARE WORKER  (your-worker.workers.dev)                       │
│                                                                     │
│  Security middleware chain:                                         │
│  1. IP rate limit (60 req/min per IP)                               │
│  2. HMAC verification (constant-time, timestamp freshness)          │
│  3. Replay prevention (nonce deduplication via KV)                  │
│  4. Row-level security (enforce logged_in_customer_id ownership)    │
│  5. Per-customer rate limit (20 writes/min)                         │
│  6. Input validation (GID format, size caps)                        │
│                                                                     │
│  Routes:                                                            │
│  POST /wishlist/add     → append product GID to metafield           │
│  POST /wishlist/remove  → remove product GID from metafield         │
│  GET  /wishlist/list    → return current metafield value            │
│  POST /wishlist/merge   → merge guest localStorage list on login    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SHOPIFY ADMIN GRAPHQL API                                          │
│                                                                     │
│  metafieldsSet mutation on Customer resource                        │
│  namespace: "$app:wishlist"  key: "saved_products"                  │
│  type: list.product_reference                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOMER ACCOUNTS 2.0 (Accounts Page)                             │
│                                                                     │
│  Customer Account UI Extension                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Profile Block: "My Wishlist →"  (entry point on profile)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Full Page: /apps/extensions/wishlist                         │   │
│  │  Reads metafield via Customer Account API (shopify.query())   │   │
│  │  Hydrates product details via Storefront API                  │   │
│  │  Renders s-grid of product cards with Remove action           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

| Action | Trigger | Path | Storage |
|---|---|---|---|
| Add to wishlist (logged in) | PDP button click | Browser → App Proxy → Worker → Admin API | Customer metafield |
| Add to wishlist (guest) | PDP button click | Browser only | `localStorage` |
| Sync guest list on login | Page load after auth | Browser → App Proxy → Worker → Admin API | Merge into metafield |
| View wishlist | Accounts page | Extension → Customer Account API → Storefront API | Read from metafield |
| Remove from wishlist | Accounts page button | Extension → App Proxy → Worker → Admin API | Update metafield |

---

## 2. Prerequisites & Environment Setup

### 2.1 Required Accounts & Access

- [ ] Shopify Partner account with a development store
- [ ] Cloudflare account (Workers free tier sufficient for dev; paid for rate limiting API)
- [ ] Node.js 18+ installed
- [ ] Shopify CLI v3.85.3 or higher (`shopify version`)
- [ ] Wrangler CLI v3+ (`wrangler --version`)
- [ ] Git repository initialized

### 2.2 Install Tooling

```bash
# Shopify CLI
npm install -g @shopify/cli@latest

# Wrangler (Cloudflare Workers CLI)
npm install -g wrangler@latest

# Verify versions
shopify version
wrangler --version
```

### 2.3 Development Store Requirements

- New Customer Accounts must be **enabled** on the development store
  - Shopify Admin → Settings → Customer accounts → select "New customer accounts"
- Store must have test products with GIDs (run generated test data if needed)
- A test customer account must exist with at least one order

### 2.4 Request Protected Customer Data Access

Customer Account UI Extensions require Level 1 Protected Customer Data access.

- Shopify Partner Dashboard → Apps → {your app} → API access
- Under "Protected customer data access" → Request access
- Minimum required: **Level 1** (name, email, phone, address)
- This is required before the Customer Account API will return customer identity

---

## 3. Phase 1 — Shopify App Scaffold

### 3.1 Initialise the App

```bash
shopify app init --name rmsc-wishlist
cd rmsc-wishlist
```

Select: **React Router** template (Remix-compatible, supports app proxy and extensions in one project).

### 3.2 Base `shopify.app.toml`

```toml
name = "rmsc-wishlist"
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-worker.workers.dev"
embedded = false

[access_scopes]
scopes = "read_customers,write_customers,write_app_proxy"

[auth]
redirect_urls = [
  "https://your-worker.workers.dev/auth/callback",
  "https://your-dev-tunnel/auth/callback"
]

[app_proxy]
url = "https://your-worker.workers.dev/wishlist"
prefix = "apps"
subpath = "wishlist"

[webhooks]
api_version = "2025-01"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "/webhooks/app-uninstalled"

[build]
automatically_update_urls_on_dev = true
dev_store_url = "your-dev-store.myshopify.com"
```

> **Note:** `application_url` points directly to the Cloudflare Worker — this is your entire backend. There is no separate Node/Remix server in this architecture.

### 3.3 Declare Customer Metafield in TOML

```toml
[[customer.metafields]]
namespace = "$app:wishlist"
key = "saved_products"
type = "list.product_reference"
name = "Wishlist Products"
description = "Products saved to this customer's wishlist"

[customer.metafields.access]
customer_account = "read_write"
```

This declarative definition:
- Creates the metafield definition on app install
- Grants the Customer Account API `read_write` access (needed for in-extension mutations)
- Scopes it to the app's reserved namespace (invisible to other apps)

---

## 4. Phase 2 — Customer Metafield Definition

### 4.1 What Gets Created

The TOML declaration above auto-provisions this on install, but document it explicitly for reference:

| Property | Value |
|---|---|
| Owner resource | `Customer` |
| Namespace | `$app:wishlist` (resolves to `app--{app-id}--wishlist` internally) |
| Key | `saved_products` |
| Type | `list.product_reference` |
| Max items | 250 (Shopify platform limit for list types) |
| Visibility | App-owned, read-only in Shopify Admin |
| Customer Account API access | `read_write` |

### 4.2 GraphQL Shape

**Read (Customer Account API from extension):**
```graphql
query GetWishlist {
  customer {
    metafield(namespace: "$app:wishlist", key: "saved_products") {
      id
      value  # JSON array of product GIDs
      updatedAt
    }
  }
}
```

**Write (Admin API from Worker):**
```graphql
mutation SetWishlist($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      value
      updatedAt
    }
    userErrors {
      field
      message
    }
  }
}
```

```json
{
  "metafields": [{
    "ownerId": "gid://shopify/Customer/123456789",
    "namespace": "$app:wishlist",
    "key": "saved_products",
    "type": "list.product_reference",
    "value": "[\"gid://shopify/Product/111\", \"gid://shopify/Product/222\"]"
  }]
}
```

---

## 5. Phase 3 — Cloudflare Worker (Secure API Backend)

### 5.1 Directory Structure

```
rmsc-wishlist/
└── worker/
    ├── src/
    │   ├── index.js              # Entry point, router
    │   ├── middleware/
    │   │   ├── hmac.js           # HMAC verification
    │   │   ├── rateLimit.js      # Rate limiting helpers
    │   │   ├── security.js       # withSecurity() middleware chain
    │   │   └── validate.js       # Input validators
    │   ├── handlers/
    │   │   ├── add.js
    │   │   ├── remove.js
    │   │   ├── list.js
    │   │   └── merge.js
    │   ├── shopify/
    │   │   └── adminApi.js       # Admin GraphQL helpers
    │   └── utils/
    │       ├── errors.js         # AuthError, ValidationError
    │       └── response.js       # corsHeaders(), secureHeaders()
    ├── wrangler.toml
    └── package.json
```

### 5.2 `wrangler.toml`

```toml
name = "rmsc-wishlist-worker"
main = "src/index.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
SHOP_DOMAIN = "rockymountainsoap.com"
SHOP_MYSHOPIFY_DOMAIN = "rocky-mountain-soap.myshopify.com"
MAX_WISHLIST_SIZE = "250"
HMAC_MAX_AGE_SECONDS = "300"

[[kv_namespaces]]
binding = "NONCE_KV"
id = "YOUR_KV_NAMESPACE_ID"

[[unsafe.bindings]]
name = "WISHLIST_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 20, period = 60 }

[[unsafe.bindings]]
name = "IP_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1002"
simple = { limit = 60, period = 60 }

[env.production]
vars = { ENVIRONMENT = "production" }

[env.staging]
vars = { ENVIRONMENT = "staging" }
```

**Secrets (set via CLI, never committed to repo):**

```bash
wrangler secret put SHOPIFY_ADMIN_TOKEN       # Custom app Admin API token
wrangler secret put SHOPIFY_PROXY_SECRET      # App client secret (for HMAC)
wrangler secret put SHOPIFY_STOREFRONT_TOKEN  # Public Storefront API token
```

### 5.3 `src/utils/errors.js`

```js
export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(retryAfter = 60) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
```

### 5.4 `src/utils/response.js`

```js
const ALLOWED_ORIGINS = (env) => [
  `https://${env.SHOP_DOMAIN}`,
  `https://${env.SHOP_MYSHOPIFY_DOMAIN}`,
];

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS(env);
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export function secureHeaders(request, env) {
  return {
    ...corsHeaders(request, env),
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };
}

export function jsonResponse(data, status = 200, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secureHeaders(request, env),
  });
}

export function errorResponse(message, status, request, env) {
  // Never leak internal details — always use generic reason strings
  return new Response(
    JSON.stringify({ ok: false, reason: message }),
    { status, headers: secureHeaders(request, env) }
  );
}
```

### 5.5 `src/middleware/hmac.js`

```js
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function verifyShopifyHmac(url, secret, maxAgeSeconds = 300) {
  const params = new URL(url).searchParams;
  const signature = params.get('signature');

  // Fast-fail: no signature present
  if (!signature) return false;

  // Timestamp freshness check (replay prevention — layer 1)
  const timestamp = parseInt(params.get('timestamp') ?? '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(timestamp) || Math.abs(now - timestamp) > maxAgeSeconds) return false;

  // Build HMAC message: all params except 'signature', sorted alphabetically
  const message = [...params.entries()]
    .filter(([k]) => k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

  // Constant-time verification via Web Crypto (no timing attacks)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  try {
    return await crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature),
      encoder.encode(message)
    );
  } catch {
    return false;
  }
}
```

### 5.6 `src/middleware/validate.js`

```js
import { ValidationError, AuthError } from '../utils/errors.js';

const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const CUSTOMER_ID_REGEX = /^\d+$/;

export function validateCustomerId(id) {
  if (!id || id === 'null' || id === '0' || id === '') {
    throw new AuthError('Authentication required');
  }
  if (!CUSTOMER_ID_REGEX.test(id)) {
    throw new AuthError('Invalid customer identity');
  }
  return id;
}

export function validateProductGid(gid) {
  if (typeof gid !== 'string' || !gid) {
    throw new ValidationError('productGid is required');
  }
  if (!PRODUCT_GID_REGEX.test(gid)) {
    throw new ValidationError('Invalid productGid format');
  }
  return gid;
}

export function validateGidArray(gids) {
  if (!Array.isArray(gids)) throw new ValidationError('Expected array of GIDs');
  if (gids.length > 250) throw new ValidationError('Exceeds maximum list size');
  return gids.map(validateProductGid);
}

export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
}
```

### 5.7 `src/middleware/security.js`

```js
import { verifyShopifyHmac } from './hmac.js';
import { validateCustomerId } from './validate.js';
import { AuthError, ValidationError, RateLimitError } from '../utils/errors.js';
import { errorResponse } from '../utils/response.js';

export async function withSecurity(request, env, handler, { requireAuth = true } = {}) {
  // ── 1. PREFLIGHT ──────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // ── 2. IP RATE LIMIT ──────────────────────────────────────────
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipCheck = await env.IP_RATE_LIMITER.limit({ key: clientIP });
  if (!ipCheck.success) {
    return errorResponse('rate_limited', 429, request, env);
  }

  // ── 3. HMAC VERIFICATION (must run before body parsing) ───────
  const maxAge = parseInt(env.HMAC_MAX_AGE_SECONDS ?? '300', 10);
  const valid = await verifyShopifyHmac(request.url, env.SHOPIFY_PROXY_SECRET, maxAge);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── 4. NONCE DEDUPLICATION (replay prevention — layer 2) ─────
  const url = new URL(request.url);
  const timestamp = url.searchParams.get('timestamp');
  const sig = url.searchParams.get('signature');
  if (timestamp && sig) {
    const nonce = `${timestamp}-${sig.substring(0, 16)}`;
    try {
      const seen = await env.NONCE_KV.get(nonce);
      if (seen) return new Response('Unauthorized', { status: 401 });
      await env.NONCE_KV.put(nonce, '1', { expirationTtl: maxAge });
    } catch (e) {
      // KV unavailable — log but don't block (degrade gracefully)
      console.error('Nonce KV error:', e.message);
    }
  }

  // ── 5. IDENTITY EXTRACTION ────────────────────────────────────
  const customerId = url.searchParams.get('logged_in_customer_id');
  const shop = url.searchParams.get('shop');

  // ── 6. CUSTOMER RATE LIMIT ────────────────────────────────────
  const rateLimitKey = customerId ?? `anon:${clientIP}`;
  const custCheck = await env.WISHLIST_RATE_LIMITER.limit({ key: rateLimitKey });
  if (!custCheck.success) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'rate_limited' }),
      {
        status: 429,
        headers: { 'Retry-After': '60', 'Content-Type': 'application/json' },
      }
    );
  }

  // ── 7. DELEGATE TO HANDLER ────────────────────────────────────
  try {
    if (requireAuth) validateCustomerId(customerId);
    return await handler({ request, env, customerId, shop });
  } catch (e) {
    if (e instanceof AuthError)      return new Response('Forbidden', { status: 403 });
    if (e instanceof ValidationError) return errorResponse(e.message, 422, request, env);
    if (e instanceof RateLimitError) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: { 'Retry-After': String(e.retryAfter) },
      });
    }
    // Do not leak internal error details to the client
    console.error('Unhandled worker error:', e);
    return errorResponse('server_error', 500, request, env);
  }
}
```

### 5.8 `src/shopify/adminApi.js`

```js
const NAMESPACE = '$app:wishlist';
const KEY = 'saved_products';

function adminFetch(shop, token, query, variables = {}) {
  return fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
}

export async function getWishlist(customerId, shop, token) {
  const res = await adminFetch(shop, token, `
    query GetWishlist($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          id
          value
          updatedAt
        }
      }
    }
  `, { id: `gid://shopify/Customer/${customerId}` });

  const data = await res.json();

  if (data.errors) {
    console.error('Admin API errors:', data.errors);
    throw new Error('Failed to read wishlist');
  }

  const metafield = data.data?.customer?.metafield;
  const list = metafield?.value ? JSON.parse(metafield.value) : [];
  return { list, metafieldId: metafield?.id ?? null };
}

export async function setWishlist(customerId, list, shop, token) {
  const res = await adminFetch(shop, token, `
    mutation SetWishlist($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id value updatedAt }
        userErrors { field message }
      }
    }
  `, {
    metafields: [{
      ownerId: `gid://shopify/Customer/${customerId}`,
      namespace: NAMESPACE,
      key: KEY,
      type: 'list.product_reference',
      value: JSON.stringify(list),
    }]
  });

  const data = await res.json();
  const userErrors = data.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    console.error('metafieldsSet userErrors:', userErrors);
    throw new Error('Failed to update wishlist');
  }

  return data.data?.metafieldsSet?.metafields?.[0];
}
```

### 5.9 Route Handlers

**`src/handlers/add.js`**

```js
import { withSecurity } from '../middleware/security.js';
import { validateProductGid, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';

export function handleAdd(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const body = await parseBody(request);
    const productGid = validateProductGid(body.productGid);
    const maxSize = parseInt(env.MAX_WISHLIST_SIZE ?? '250', 10);

    const { list } = await getWishlist(customerId, shop, env.SHOPIFY_ADMIN_TOKEN);

    if (list.includes(productGid)) {
      // Idempotent — already in list, return success without writing
      return jsonResponse({ ok: true, list, alreadySaved: true }, 200, request, env);
    }

    if (list.length >= maxSize) {
      return jsonResponse({ ok: false, reason: 'wishlist_full', limit: maxSize }, 422, request, env);
    }

    list.push(productGid);
    await setWishlist(customerId, list, shop, env.SHOPIFY_ADMIN_TOKEN);

    return jsonResponse({ ok: true, list }, 200, request, env);
  });
}
```

**`src/handlers/remove.js`**

```js
import { withSecurity } from '../middleware/security.js';
import { validateProductGid, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';

export function handleRemove(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const body = await parseBody(request);
    const productGid = validateProductGid(body.productGid);

    const { list } = await getWishlist(customerId, shop, env.SHOPIFY_ADMIN_TOKEN);
    const updated = list.filter(gid => gid !== productGid);

    if (updated.length !== list.length) {
      await setWishlist(customerId, updated, shop, env.SHOPIFY_ADMIN_TOKEN);
    }

    return jsonResponse({ ok: true, list: updated }, 200, request, env);
  });
}
```

**`src/handlers/list.js`**

```js
import { withSecurity } from '../middleware/security.js';
import { getWishlist } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';

export function handleList(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const { list } = await getWishlist(customerId, shop, env.SHOPIFY_ADMIN_TOKEN);
    return jsonResponse({ ok: true, list }, 200, request, env);
  });
}
```

**`src/handlers/merge.js`**

```js
import { withSecurity } from '../middleware/security.js';
import { validateGidArray, parseBody } from '../middleware/validate.js';
import { getWishlist, setWishlist } from '../shopify/adminApi.js';
import { jsonResponse } from '../utils/response.js';

export function handleMerge(request, env) {
  return withSecurity(request, env, async ({ customerId, shop }) => {
    const body = await parseBody(request);
    const localList = validateGidArray(body.local ?? []);
    const maxSize = parseInt(env.MAX_WISHLIST_SIZE ?? '250', 10);

    const { list: serverList } = await getWishlist(customerId, shop, env.SHOPIFY_ADMIN_TOKEN);

    // Merge and deduplicate, server list takes precedence, respect size cap
    const merged = [...new Set([...serverList, ...localList])].slice(0, maxSize);

    if (merged.length !== serverList.length) {
      await setWishlist(customerId, merged, shop, env.SHOPIFY_ADMIN_TOKEN);
    }

    return jsonResponse({ ok: true, list: merged }, 200, request, env);
  });
}
```

### 5.10 `src/index.js` — Entry Point & Router

```js
import { handleAdd }    from './handlers/add.js';
import { handleRemove } from './handlers/remove.js';
import { handleList }   from './handlers/list.js';
import { handleMerge }  from './handlers/merge.js';

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Unauthenticated health check for Cloudflare monitoring
    if (path === '/health' && method === 'GET') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Route table
    if (path.endsWith('/wishlist/add')    && method === 'POST') return handleAdd(request, env);
    if (path.endsWith('/wishlist/remove') && method === 'POST') return handleRemove(request, env);
    if (path.endsWith('/wishlist/list')   && method === 'GET')  return handleList(request, env);
    if (path.endsWith('/wishlist/merge')  && method === 'POST') return handleMerge(request, env);

    return new Response('Not Found', { status: 404 });
  },
};
```

---

## 6. Phase 4 — Shopify App Proxy Configuration

### 6.1 How the Proxy Works

When a storefront customer visits `https://yourstore.myshopify.com/apps/wishlist/add`, Shopify:

1. Injects query params: `logged_in_customer_id`, `shop`, `path_prefix`, `timestamp`
2. Generates an HMAC signature over all params using your app's client secret
3. Forwards the signed request to `https://your-worker.workers.dev/wishlist/add`

The browser never communicates directly with your Worker — it always goes through Shopify's proxy, which is what guarantees `logged_in_customer_id` is trustworthy.

### 6.2 TOML Configuration (declared in Phase 1)

```toml
[app_proxy]
url = "https://your-worker.workers.dev/wishlist"
prefix = "apps"
subpath = "wishlist"
```

Resulting URL mapping:
- `/apps/wishlist` → `/wishlist`
- `/apps/wishlist/add` → `/wishlist/add`
- `/apps/wishlist/remove` → `/wishlist/remove`
- `/apps/wishlist/list` → `/wishlist/list`
- `/apps/wishlist/merge` → `/wishlist/merge`

### 6.3 Testing the Proxy Locally

```bash
# Start dev tunnel
shopify app dev

# Direct Worker hit (no HMAC) → confirms Worker is alive, expect 401
curl https://your-dev-store.myshopify.com/apps/wishlist/health

# Proxy hit via browser while logged into dev store → HMAC added by Shopify
# Open: https://your-dev-store.myshopify.com/apps/wishlist/list
```

---

## 7. Phase 5 — Theme App Extension (PDP Button)

### 7.1 Generate the Extension

```bash
shopify app generate extension \
  --template theme_app_extension \
  --name wishlist-button
```

### 7.2 Directory Structure

```
extensions/
└── wishlist-button/
    ├── assets/
    │   ├── wishlist-button.js    # Vanilla JS — add/remove logic, guest state
    │   └── wishlist-button.css  # Button + active state styles
    ├── blocks/
    │   └── wishlist-button.liquid  # App block (draggable in theme editor)
    ├── snippets/
    │   └── wishlist-init.liquid    # Guest→account sync on page load
    └── shopify.extension.toml
```

### 7.3 `shopify.extension.toml`

```toml
api_version = "2025-10"

[[extensions]]
type = "theme_app_extension"
name = "Wishlist Button"
handle = "wishlist-button"
```

### 7.4 `blocks/wishlist-button.liquid`

```liquid
{%- comment -%}
  App Block: Wishlist Button
  Placement: Product page sections (merchants add via theme editor)
  Requires: /apps/wishlist App Proxy active
{%- endcomment -%}

<div
  id="wishlist-btn-{{ product.id }}"
  class="wishlist-wrapper"
  data-product-gid="gid://shopify/Product/{{ product.id }}"
  data-product-handle="{{ product.handle }}"
  data-customer-logged-in="{% if customer %}true{% else %}false{% endif %}"
>
  <button
    class="wishlist-btn"
    aria-label="Add {{ product.title | escape }} to wishlist"
    aria-pressed="false"
    data-wishlist-toggle
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
               a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84
               a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
    {% if block.settings.show_label %}
      <span class="wishlist-btn__label">Save</span>
    {% endif %}
  </button>
</div>

{{ 'wishlist-button.css' | asset_url | stylesheet_tag }}
<script src="{{ 'wishlist-button.js' | asset_url }}" defer></script>

{% schema %}
{
  "name": "Wishlist Button",
  "target": "section",
  "settings": [
    {
      "type": "checkbox",
      "id": "show_label",
      "label": "Show label text",
      "default": true
    },
    {
      "type": "color",
      "id": "active_color",
      "label": "Active heart colour",
      "default": "#8B5E3C"
    }
  ]
}
{% endschema %}
```

### 7.5 `assets/wishlist-button.js`

```js
/**
 * RMSC Wishlist Button
 * Manages add/remove state on PDP and PLP.
 * Logged-in: writes to customer metafield via App Proxy → Cloudflare Worker.
 * Guest: writes to localStorage, merged to metafield on next login.
 */
(function () {
  'use strict';

  const PROXY_BASE  = '/apps/wishlist';
  const STORAGE_KEY = 'rmsc_wishlist_guest';
  const LIST_CACHE_KEY = 'rmsc_wishlist_cache';

  // ── localStorage helpers ────────────────────────────────────────
  function getGuestList() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveGuestList(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { console.warn('Wishlist: localStorage unavailable', e); }
  }

  // ── Session cache (avoids re-fetching list for every button on a page) ──
  let listCache = null;
  async function getCachedList() {
    if (listCache !== null) return listCache;
    try {
      const res = await fetch(`${PROXY_BASE}/list`);
      if (!res.ok) throw new Error(res.status);
      const { list } = await res.json();
      listCache = Array.isArray(list) ? list : [];
    } catch {
      listCache = [];
    }
    return listCache;
  }

  // ── Button state ────────────────────────────────────────────────
  function setButtonState(btn, isActive) {
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('wishlist-btn--active', isActive);
    const label = btn.querySelector('.wishlist-btn__label');
    if (label) label.textContent = isActive ? 'Saved' : 'Save';
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.classList.toggle('wishlist-btn--loading', loading);
  }

  // ── Init single button ──────────────────────────────────────────
  async function initButton(wrapper) {
    const btn        = wrapper.querySelector('[data-wishlist-toggle]');
    if (!btn) return;

    const productGid  = wrapper.dataset.productGid;
    const isLoggedIn  = wrapper.dataset.customerLoggedIn === 'true';

    // Determine initial active state
    let inWishlist = false;
    try {
      if (isLoggedIn) {
        const list = await getCachedList();
        inWishlist = list.includes(productGid);
      } else {
        inWishlist = getGuestList().includes(productGid);
      }
    } catch {
      // State unknown — default to inactive
    }
    setButtonState(btn, inWishlist);

    // Click handler
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentlyActive = btn.getAttribute('aria-pressed') === 'true';
      const action = currentlyActive ? 'remove' : 'add';

      setLoading(btn, true);
      try {
        if (isLoggedIn) {
          const res = await fetch(`${PROXY_BASE}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productGid }),
          });
          if (!res.ok) throw new Error(res.status);
          const { list } = await res.json();
          listCache = list; // Update session cache
        } else {
          let list = getGuestList();
          list = currentlyActive
            ? list.filter(gid => gid !== productGid)
            : [...new Set([...list, productGid])];
          saveGuestList(list);
        }

        setButtonState(btn, !currentlyActive);

        // Dispatch for analytics / Klaviyo hooks
        document.dispatchEvent(new CustomEvent('wishlist:changed', {
          detail: { action, productGid, isLoggedIn },
          bubbles: true,
        }));
      } catch (err) {
        console.error('Wishlist toggle failed', err);
        setButtonState(btn, currentlyActive); // Restore previous state
      } finally {
        setLoading(btn, false);
      }
    });
  }

  // ── Init all buttons on page ─────────────────────────────────────
  function initAll() {
    document.querySelectorAll('[id^="wishlist-btn-"]').forEach(initButton);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Re-init after Shopify section reloads (theme editor live preview)
  document.addEventListener('shopify:section:load', initAll);
})();
```

### 7.6 `assets/wishlist-button.css`

```css
.wishlist-wrapper { display: inline-flex; }

.wishlist-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.15s ease, background 0.15s ease;
}

.wishlist-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  transition: fill 0.15s ease, stroke 0.15s ease;
  pointer-events: none;
}

.wishlist-btn--active svg {
  fill: var(--wishlist-active-color, #8B5E3C);
  stroke: var(--wishlist-active-color, #8B5E3C);
}

.wishlist-btn--loading {
  opacity: 0.6;
  pointer-events: none;
}

.wishlist-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

---

## 8. Phase 6 — Customer Account UI Extension (Wishlist Page)

### 8.1 Generate Extensions

```bash
# Full-page wishlist view
shopify app generate extension \
  --template customer_account_ui \
  --name wishlist-full-page

# Profile block entry point
shopify app generate extension \
  --template customer_account_ui \
  --name wishlist-profile-block
```

### 8.2 Full-Page Extension — `shopify.extension.toml`

```toml
api_version = "2025-10"

[[extensions]]
uid = "GENERATE-WITH-CLI"
type = "ui_extension"
name = "My Wishlist"
handle = "wishlist-full-page"

[[extensions.targeting]]
module = "./src/FullPageExtension.jsx"
target = "customer-account.page.render"

[extensions.capabilities]
api_access = true
```

### 8.3 Full-Page Extension — `src/FullPageExtension.jsx`

```jsx
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

export default async () => { render(<WishlistPage />, document.body); };

const NAMESPACE  = '$app:wishlist';
const KEY        = 'saved_products';
const PROXY_BASE = '/apps/wishlist';

async function fetchWishlistGids() {
  const data = await shopify.query(`
    query GetWishlist {
      customer {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          value
        }
      }
    }
  `);
  const raw = data.data?.customer?.metafield?.value;
  return raw ? JSON.parse(raw) : [];
}

async function fetchProductDetails(gids) {
  if (!gids.length) return [];
  const data = await shopify.query(`
    query GetProducts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          onlineStoreUrl
          availableForSale
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
        }
      }
    }
  `, { variables: { ids: gids } });
  return (data.data?.nodes ?? []).filter(Boolean);
}

function WishlistPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [removing, setRemoving] = useState(null);
  const [error, setError]       = useState(null);

  const loadWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const gids    = await fetchWishlistGids();
      const details = await fetchProductDetails(gids);
      setProducts(details);
    } catch (e) {
      console.error('Failed to load wishlist', e);
      setError('Failed to load your wishlist. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWishlist(); }, []);

  async function removeItem(productGid) {
    setRemoving(productGid);
    try {
      await fetch(`${PROXY_BASE}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productGid }),
      });
      setProducts(prev => prev.filter(p => p.id !== productGid));
    } catch (e) {
      console.error('Remove failed', e);
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <s-page heading="My Wishlist">
        <s-skeleton-text lines={4} />
      </s-page>
    );
  }

  if (error) {
    return (
      <s-page heading="My Wishlist">
        <s-banner status="critical">{error}</s-banner>
      </s-page>
    );
  }

  if (products.length === 0) {
    return (
      <s-page heading="My Wishlist">
        <s-section>
          <s-stack direction="block" gap="base" inlineAlignment="center">
            <s-text>You haven't saved any products yet.</s-text>
            <s-button href="/">Start shopping</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading={`My Wishlist (${products.length})`}>
      <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
        {products.map(product => (
          <s-section key={product.id}>
            {product.featuredImage && (
              <s-image
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
              />
            )}
            <s-stack direction="block" gap="small-500">
              <s-text type="strong">{product.title}</s-text>
              <s-text color="subdued">
                {shopify.i18n.formatCurrency(
                  product.priceRange.minVariantPrice.amount,
                  { currency: product.priceRange.minVariantPrice.currencyCode }
                )}
              </s-text>
              {!product.availableForSale && (
                <s-badge status="warning">Out of stock</s-badge>
              )}
            </s-stack>
            <s-button slot="primary-action" href={product.onlineStoreUrl}>
              View product
            </s-button>
            <s-button
              slot="secondary-actions"
              loading={removing === product.id}
              onClick={() => removeItem(product.id)}
            >
              Remove
            </s-button>
          </s-section>
        ))}
      </s-grid>
    </s-page>
  );
}
```

### 8.4 Profile Block — `shopify.extension.toml`

```toml
api_version = "2025-10"

[[extensions]]
uid = "GENERATE-WITH-CLI"
type = "ui_extension"
name = "Wishlist Profile Block"
handle = "wishlist-profile-block"

[[extensions.targeting]]
module = "./src/ProfileBlockExtension.jsx"
target = "customer-account.profile.block.render"

[extensions.capabilities]
api_access = true
```

### 8.5 Profile Block — `src/ProfileBlockExtension.jsx`

```jsx
import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export default async () => { render(<WishlistProfileBlock />, document.body); };

function WishlistProfileBlock() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    shopify.query(`
      query {
        customer {
          metafield(namespace: "$app:wishlist", key: "saved_products") {
            value
          }
        }
      }
    `).then(data => {
      const raw  = data.data?.customer?.metafield?.value;
      const list = raw ? JSON.parse(raw) : [];
      setCount(list.length);
    }).catch(() => setCount(0));
  }, []);

  const label = count === null
    ? 'View wishlist'
    : count === 0
    ? 'View wishlist'
    : `View wishlist (${count})`;

  return (
    <s-section
      heading="My Wishlist"
      primaryAction={{
        content: label,
        onPress: () => shopify.navigate('/apps/extensions/wishlist-full-page'),
      }}
    >
      <s-text color="subdued">
        {count === null
          ? 'Loading...'
          : count === 0
          ? 'No saved products yet'
          : `${count} saved ${count === 1 ? 'product' : 'products'}`}
      </s-text>
    </s-section>
  );
}
```

---

## 9. Phase 7 — Guest-to-Account Sync

### 9.1 Sync Snippet — `snippets/wishlist-init.liquid`

Include this snippet in `theme.liquid` just before `</body>`. It fires silently on every page load when a customer is logged in, detects any leftover guest localStorage data, and posts it to the merge endpoint.

```liquid
{%- comment -%}
  wishlist-init.liquid
  Merges guest localStorage wishlist into customer metafield on login.
  Safe to include on every page — no-ops when localStorage is empty.
{%- endcomment -%}
{% if customer %}
<script>
(function () {
  var STORAGE_KEY = 'rmsc_wishlist_guest';
  var local;
  try {
    local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return;
  }
  if (!local.length) return;

  fetch('/apps/wishlist/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ local: local }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) {
        localStorage.removeItem(STORAGE_KEY);
        // Notify any wishlist buttons on the page to refresh their state
        document.dispatchEvent(new CustomEvent('wishlist:synced', {
          detail: { list: data.list },
          bubbles: true,
        }));
      }
    })
    .catch(function (e) {
      console.warn('Wishlist sync failed', e);
    });
})();
</script>
{% endif %}
```

**Include in `theme.liquid`:**
```liquid
{%- render 'wishlist-init' -%}
</body>
```

### 9.2 Merge Logic in Worker (implemented in Phase 5.9)

- Server wishlist takes precedence in merge order
- Deduplication via `Set`
- Result is capped to 250 items
- Returns the merged list to allow client cache update

---

## 10. Phase 8 — Security Hardening

All security is implemented in Phase 3. This phase confirms the audit and provides a reference for the decisions made.

### 10.1 Row-Level Security

**Guarantee:** Customer A cannot read or write Customer B's wishlist under any circumstances.

- `logged_in_customer_id` is injected by Shopify's proxy server — the browser cannot set or override it
- Worker constructs `ownerId` as `gid://shopify/Customer/${customerId}` server-side — never from request body
- Customer ID validated against `/^\d+$/` before any downstream call
- Unauthenticated requests (no `logged_in_customer_id`) receive 403 on all write endpoints

### 10.2 HMAC Verification

- Uses `crypto.subtle.verify()` — constant-time comparison, no timing oracle
- Timestamp validated within ±300 seconds (configurable)
- All query params (except `signature`) sorted and included in message — no parameter injection
- Runs before body parsing, before KV reads, before any business logic

### 10.3 Replay Attack Prevention

Layer 1: Timestamp window (5 minutes) — cheap CPU check  
Layer 2: Nonce KV deduplication — prevents exact replays within the time window  
KV errors degrade gracefully (log + continue) to avoid downtime from KV unavailability

### 10.4 Rate Limiting

- IP-level: 60 req/min — blocks flood attacks before HMAC is checked
- Customer-level: 20 writes/min — prevents abuse from a single authenticated customer
- Both use Cloudflare's native Rate Limiting API (atomic, edge-distributed, no KV overhead)
- `Retry-After` header always returned on 429

### 10.5 Input Validation

- Product GID: strict regex, type-checked before any array operation
- Array inputs (merge): each element individually validated, total length capped at 250
- Body parse failures return 422, never 500
- All size enforcement happens before the Admin API call — no partial writes

### 10.6 Secrets & Token Scope

| Secret | Scope | Storage |
|---|---|---|
| `SHOPIFY_ADMIN_TOKEN` | `read_customers`, `write_customers` only | Wrangler secret |
| `SHOPIFY_PROXY_SECRET` | App client secret | Wrangler secret |
| `SHOPIFY_STOREFRONT_TOKEN` | Read-only public token | Wrangler secret |

Custom App token is created in Shopify Admin (not Partner Dashboard) with no extra scopes.

### 10.7 Error Handling

- All errors return generic `reason` strings (`server_error`, `rate_limited`, `wishlist_full`)
- Internal Admin API errors logged to Cloudflare Logpush — never to response body
- `AuthError` → 403, `ValidationError` → 422, unhandled → 500 (generic)

---

## 11. Phase 9 — Testing & QA

### 11.1 Unit Tests (Vitest)

```bash
cd worker && npm install --save-dev vitest
```

| Test Case | File |
|---|---|
| HMAC — valid signature passes | `middleware/hmac.test.js` |
| HMAC — tampered param fails | `middleware/hmac.test.js` |
| HMAC — expired timestamp fails | `middleware/hmac.test.js` |
| HMAC — missing signature fails | `middleware/hmac.test.js` |
| Customer ID — valid integer passes | `middleware/validate.test.js` |
| Customer ID — empty string throws AuthError | `middleware/validate.test.js` |
| Customer ID — `"0"` throws AuthError | `middleware/validate.test.js` |
| Customer ID — SQL injection string throws AuthError | `middleware/validate.test.js` |
| Product GID — valid format passes | `middleware/validate.test.js` |
| Product GID — missing `gid://` prefix fails | `middleware/validate.test.js` |
| Product GID — non-numeric ID fails | `middleware/validate.test.js` |
| Add — new product appended | `handlers/add.test.js` |
| Add — duplicate is idempotent (no double write) | `handlers/add.test.js` |
| Add — at cap (250) returns `wishlist_full` | `handlers/add.test.js` |
| Remove — item removed from list | `handlers/remove.test.js` |
| Remove — missing item is idempotent | `handlers/remove.test.js` |
| Merge — deduplicates correctly | `handlers/merge.test.js` |
| Merge — respects 250 size cap | `handlers/merge.test.js` |
| Merge — empty local array is no-op | `handlers/merge.test.js` |

### 11.2 Integration Tests (Dev Store)

| Scenario | Expected Result |
|---|---|
| Guest adds product | Appears in `localStorage`, button shows active state |
| Guest adds same product twice | No duplicate in `localStorage` |
| Guest logs in | Merge fires, `localStorage` cleared, button state preserved |
| Logged-in adds product | Metafield updated, button active |
| Logged-in adds duplicate | `alreadySaved: true`, no re-write |
| Logged-in removes product | Removed from metafield, button inactive |
| Accounts profile block | Shows correct count from metafield |
| Accounts wishlist page | Products load with images, prices, Remove buttons |
| Remove from accounts page | List updates without page reload |
| Out-of-stock product in list | Badge rendered |
| Empty wishlist | Empty state CTA rendered |
| Customer A forges Customer B's ID in body | Ignored — Worker uses `logged_in_customer_id` |
| Direct Worker call without HMAC | 401 |
| Replayed signed request | 401 on second attempt |
| >20 writes per min same customer | 429 with `Retry-After: 60` |
| Malformed GID in body | 422 |
| 250 items + add one more | `wishlist_full` error, no write |
| Worker secrets not in response body | No token/secret in any response |

### 11.3 Accessibility QA

- [ ] `aria-label` present and descriptive on wishlist button
- [ ] `aria-pressed` state updated on toggle (announced by screen readers)
- [ ] Focus ring visible on keyboard navigation
- [ ] `disabled` state during loading prevents double-submit
- [ ] Wishlist page uses semantic Polaris components (inherits accessibility from platform)
- [ ] Remove button is keyboard operable

### 11.4 Performance QA

- [ ] Wishlist button JS loaded with `defer` — zero render blocking
- [ ] List fetched once per page load and cached in memory — not once per button
- [ ] No Admin API calls from the browser — all go through Proxy → Worker
- [ ] Cloudflare Worker p99 response time < 200ms (measure via `wrangler tail`)
- [ ] Core Web Vitals unaffected — confirm with Lighthouse before/after

---

## 12. Phase 10 — Deployment & Merchant Setup

### 12.1 Deploy Cloudflare Worker

```bash
cd worker

# Create KV namespace for nonce deduplication
wrangler kv:namespace create "NONCE_KV"
# → Copy the returned `id` into wrangler.toml [[kv_namespaces]]

# Set production secrets
wrangler secret put SHOPIFY_ADMIN_TOKEN
wrangler secret put SHOPIFY_PROXY_SECRET
wrangler secret put SHOPIFY_STOREFRONT_TOKEN

# Deploy
wrangler deploy --env production

# Confirm live
curl https://your-worker.workers.dev/health
# → { "ok": true }

# Watch live logs
wrangler tail
```

### 12.2 Deploy Shopify App & Extensions

```bash
cd ..

# Deploy all extensions + app proxy config
shopify app deploy

# Confirm in Partner Dashboard:
# Apps → rmsc-wishlist → Versions → Current version
# Extensions: wishlist-button, wishlist-full-page, wishlist-profile-block
# App proxy: /apps/wishlist → your-worker.workers.dev/wishlist
```

### 12.3 Merchant Onboarding Steps

1. **Install the app** on the production store via Partner Dashboard
2. **Theme editor:** Add "Wishlist Button" block to the product template
   - Customise → Product page → Add block → Apps → Wishlist Button
   - Configure: Show label ✅, Active colour matching brand palette
3. **Theme editor (optional):** Add Wishlist Button to collection/quick-view templates
4. **Include sync snippet** — confirm `wishlist-init` is rendered in `theme.liquid`
5. **Verify Customer Accounts view:**
   - Shopify Admin → Settings → Customer accounts → Customize
   - Confirm "Wishlist Profile Block" appears on profile page
6. **Test end-to-end** with a real customer account on the live store

### 12.4 Post-Deploy Verification Checklist

- [ ] Guest adds product on PDP — localStorage persists across page navigation
- [ ] Guest logs in — merge fires silently, localStorage cleared
- [ ] Logged-in customer adds product — metafield updated (confirm in Shopify Admin → Customers → {customer} → Metafields)
- [ ] Accounts page — profile block shows correct count
- [ ] Accounts wishlist page — all products load with correct data
- [ ] Remove from accounts page — list updates without full page reload
- [ ] Cloudflare dashboard — Worker shows healthy request pattern, 200s dominant
- [ ] No Admin API rate limit errors in `wrangler tail`

---

## 13. File & Directory Reference

```
rmsc-wishlist/
│
├── shopify.app.toml                             # App config, proxy, metafield declaration
│
├── worker/                                      # Entire backend (Cloudflare Worker)
│   ├── wrangler.toml                            # Worker config, KV, rate limit bindings
│   ├── package.json
│   └── src/
│       ├── index.js                             # Entry point, URL router
│       ├── middleware/
│       │   ├── hmac.js                          # Shopify HMAC verification (constant-time)
│       │   ├── security.js                      # withSecurity() middleware chain
│       │   └── validate.js                      # Input sanitizers and validators
│       ├── handlers/
│       │   ├── add.js                           # POST /wishlist/add
│       │   ├── remove.js                        # POST /wishlist/remove
│       │   ├── list.js                          # GET  /wishlist/list
│       │   └── merge.js                         # POST /wishlist/merge
│       ├── shopify/
│       │   └── adminApi.js                      # getWishlist(), setWishlist() via Admin GraphQL
│       └── utils/
│           ├── errors.js                        # AuthError, ValidationError, RateLimitError
│           └── response.js                      # corsHeaders(), secureHeaders(), jsonResponse()
│
└── extensions/
    │
    ├── wishlist-button/                         # Theme App Extension
    │   ├── shopify.extension.toml
    │   ├── assets/
    │   │   ├── wishlist-button.js               # Toggle logic, guest state, session cache
    │   │   └── wishlist-button.css              # Button + active/loading states
    │   ├── blocks/
    │   │   └── wishlist-button.liquid           # App block for theme editor (PDP/PLP)
    │   └── snippets/
    │       └── wishlist-init.liquid             # Guest→account sync trigger (in theme.liquid)
    │
    ├── wishlist-full-page/                      # Customer Account UI Extension (wishlist page)
    │   ├── shopify.extension.toml               # target: customer-account.page.render
    │   ├── locales/
    │   │   ├── en.default.json
    │   │   └── fr.json
    │   └── src/
    │       └── FullPageExtension.jsx            # Full wishlist page with product grid
    │
    └── wishlist-profile-block/                  # Customer Account UI Extension (entry point)
        ├── shopify.extension.toml               # target: customer-account.profile.block.render
        ├── locales/
        │   └── en.default.json
        └── src/
            └── ProfileBlockExtension.jsx        # Profile card with count + navigate action
```

---

## 14. Environment Variables Reference

| Variable | Where Set | Description |
|---|---|---|
| `SHOPIFY_ADMIN_TOKEN` | `wrangler secret put` | Custom App Admin API token. Scopes: `read_customers`, `write_customers` only |
| `SHOPIFY_PROXY_SECRET` | `wrangler secret put` | App client secret — used to verify Shopify HMAC signatures |
| `SHOPIFY_STOREFRONT_TOKEN` | `wrangler secret put` | Public Storefront API token (read-only) |
| `SHOP_DOMAIN` | `wrangler.toml [vars]` | Primary storefront domain e.g. `rockymountainsoap.com` |
| `SHOP_MYSHOPIFY_DOMAIN` | `wrangler.toml [vars]` | `.myshopify.com` domain — used for CORS allowlist |
| `MAX_WISHLIST_SIZE` | `wrangler.toml [vars]` | Maximum items per wishlist. Default: `250` |
| `HMAC_MAX_AGE_SECONDS` | `wrangler.toml [vars]` | Proxy request timestamp tolerance. Default: `300` |
| `NONCE_KV` | `wrangler.toml [[kv_namespaces]]` | KV namespace binding — nonce deduplication store |
| `WISHLIST_RATE_LIMITER` | `wrangler.toml [[unsafe.bindings]]` | Per-customer rate limit: 20 writes/60 sec |
| `IP_RATE_LIMITER` | `wrangler.toml [[unsafe.bindings]]` | Per-IP rate limit: 60 req/60 sec |

**Local development:** create `worker/.dev.vars` (git-ignored):
```
SHOPIFY_ADMIN_TOKEN=shpat_...
SHOPIFY_PROXY_SECRET=abc123...
```

---

## 15. Security Checklist

| Control | Layer | Implementation Detail |
|---|---|---|
| **HMAC signature verification** | Worker | `crypto.subtle.verify()` — constant-time, no timing oracle |
| **Timestamp freshness (±5 min)** | Worker | Checked before crypto operations — fast fail |
| **Nonce deduplication** | Worker + KV | Prevents exact request replay within time window |
| **Row-level security** | Worker | `logged_in_customer_id` from Shopify proxy only — never from body |
| **Server-side ownerId construction** | Worker | `gid://shopify/Customer/${customerId}` — never accepted from client |
| **Customer ID format validation** | Worker | Regex `/^\d+$/` — rejects empty, zero, non-numeric, injection strings |
| **Product GID format validation** | Worker | Regex `/^gid:\/\/shopify\/Product\/\d+$/` |
| **Array input validation** | Worker | Each element validated; total length checked before write |
| **Wishlist size cap** | Worker | 250 items enforced pre-write — no partial writes |
| **Per-customer rate limit** | Worker | 20 writes/60 sec via Cloudflare Rate Limiting API |
| **Per-IP rate limit** | Worker | 60 req/60 sec — applied before HMAC check |
| **CORS origin allowlist** | Worker | Store domains only — not wildcard `*` |
| **Admin token minimal scope** | Shopify Custom App | `read_customers` + `write_customers` only |
| **Secrets in Worker env** | Cloudflare | `wrangler secret put` — never in code or `wrangler.toml` |
| **Generic error responses** | Worker | No stack traces, no internal state, no token values in responses |
| **Security response headers** | Worker | `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `X-Frame-Options: DENY` |
| **Body parse failure handling** | Worker | 400/422 returned cleanly — never 500 on bad input |
| **Protected customer data access** | Shopify | Level 1 approved before Customer Account API returns identity |
| **New Customer Accounts only** | Shopify | Extension targets only render on new accounts — no legacy risk |
| **HTTPS enforced** | Cloudflare | Always-on TLS on workers.dev and custom domains |