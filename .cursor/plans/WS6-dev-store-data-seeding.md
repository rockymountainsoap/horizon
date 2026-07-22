# WS6 — Dev-store data seeding (production → development)

> **Status:** ready to execute. Written to be run in a **fresh session** — it is
> self-contained; you do not need the conversation that produced it.
>
> **Shape:** a short blocking **pre-flight** (all human decisions collected once),
> then **one continuous long-running task** that works a queue to completion. No
> mid-run approval gates — everything that needs a human is answered up front.

## Context

The PDP rework (`WS2-pdp-info-column.md`) is blocked on data, not code. The
development store has **no product metafield data at all** — verified across five
products: `custom.ingredient_allergen`, `custom.sustainability` and
`global.Instructions` all render nothing, so the pre-existing Ingredients /
Sustainability / How-to-use accordion rows are empty too. Consequences today:

- Every metafield-driven block can only be verified **negatively** (it hides cleanly).
  The data → render path is unproven.
- No dev product is a **Combined Listing** (products expose only a `Size` option), so
  the WS2 Phase 3 Scent dropdown has nothing to exercise.
- No product carries a `Best Seller` tag, so the badge's live path is unproven.
- Review stars render empty (`reviews.*` unsynced).

**Goal:** mirror a representative slice of production catalogue data into the
development store — products, tags, metafields, standard-taxonomy category +
attributes, combined listings, and selling plans — so WS2 (and future workstreams)
can be verified against realistic data.

---

## ⚠️ Safety rails — read before running anything

1. **Production is READ-ONLY.** Every production call must be a query. No mutation is
   ever issued against production. If a step seems to need a production write, stop.
2. **Confirm the store handles in pre-flight.** The repo references three, and their
   names are misleading:
   | Handle | Where it appears | What it actually is |
   |---|---|---|
   | `rocky-horizon-development` | the running `theme dev` session | the dev store used day-to-day |
   | `rocky-test-store` | `shopify.theme.toml` → `[environments.dev]` | ? |
   | `rocky-soap-development` | `shopify.theme.toml` → `production` **and** `staging` | labelled production, but the handle says development |

   **None is confirmed to be the real production store.** This is the single biggest
   risk in the task: it reads one store and writes another, and a wrong-store write is
   hard to undo. Get both handles confirmed explicitly, in writing, before the run
   starts. Do not infer from names.
3. **Never run destructive mutations on the target** (`productDelete`,
   `metafieldDefinitionDelete` with `deleteAllAssociatedMetafields: true`, bulk
   variant deletes). Seeding is additive; if a reset is needed, stop and ask.
4. Catalogue only — **no customer or order data**.
5. **Synthetic copy must never travel back to production.** See the synthesis policy.

---

## Tooling

Shopify Admin GraphQL via the CLI (installed, v3.94.3; a v4 upgrade is available and
fine to take first):

```
shopify store auth      # authenticate against a store
shopify store execute   # run queries/mutations
```

Use the bundled plugin skills rather than hand-writing GraphQL from memory:

- **`shopify-plugin:shopify-custom-data`** — **use first** for anything touching
  metafields or metaobjects (definitions, taxonomy attributes)
- **`shopify-plugin:shopify-admin`** — authoring Admin GraphQL operations
- **`shopify-plugin:shopify-use-shopify-cli`** — running them, auth/troubleshooting

> If a Shopify MCP server is connected in the session, prefer it for the same
> operations. At the time of writing none was connected — the CLI path above is the
> working route. Verify current API version and operation names with the skills; do
> not trust sketches in this document verbatim.

---

## Data inventory

### Group 1 — Metafields that EXIST in production → **mirror**

Grepped from `blocks/`, `snippets/`, `sections/`; exhaustive for what the theme reads.

| Namespace + key | Consumer | Notes |
|---|---|---|
| `custom.ingredient_allergen` | `blocks/r-pdp-ingredients.liquid` | via `metafield_tag`; `†` → `<sup>` |
| `custom.sustainability` | `blocks/r-pdp-sustainability.liquid` | via `metafield_tag` |
| `global.Instructions` | `blocks/r-pdp-how-to-use.liquid` | ⚠️ **capital `I`** — preserve exactly; a lower-case key silently renders nothing |
| `global.organic` | `blocks/r-pdp-description.liquid` | numeric percent |
| `reviews.rating` / `reviews.rating_count` | `blocks/review.liquid` | app-owned (Judge.me) — see Group 4 |

**Mirror definitions exactly** — read each definition's `type`, `name` and validations
from production and recreate them identically. A type mismatch changes
`metafield_tag` output shape (e.g. `rich_text_field` vs `multi_line_text_field`).

### Group 2 — Metafields introduced by WS2 Phase 2 → **create + populate** ⭐

These are **new**. They do **not** exist in production, so there is nothing to mirror:
the definitions must be created on dev, and the content **generated** (see synthesis
policy). This is the part of the task that is authoring, not copying.

| Purpose | Primary source (taxonomy) | Rocky fallback | Suggested type |
|---|---|---|---|
| Made with | `shopify.<handle TBD>` | `rocky.made_with` | `list.single_line_text_field` |
| Skin type | `shopify.skin-type` | `rocky.skin_type` | `list.single_line_text_field` |
| Scent subtitle | product option `Scent` | `rocky.scent` | `single_line_text_field` |

`blocks/r-pdp-attribute.liquid` reads **primary, then fallback**, so either source
satisfies it. Seed the `rocky.*` fallbacks unconditionally (fast, fully in our
control), and additionally set the `shopify.*` taxonomy attributes where the category
exposes them — that exercises the primary path too.

Carried over from Phase 2 research:
- Standard-taxonomy attributes surface as metafields in the **`shopify`** namespace,
  keyed by attribute handle, values are **`list.metaobject_reference`**.
- Dashed handles need bracket notation in Liquid — already handled in the block.
- **Discover the real "Made with" handle during the run** and write it back into
  `WS2-pdp-info-column.md` and the `key` setting in `templates/product.json` (it is
  intentionally blank today).

### Group 3 — Tags that drive behaviour

- `Best Seller` — trigger for `blocks/r-pdp-badge.liquid` (case-insensitive match)
- `bath bomb offer`, `earth-promo` — promo lines in `r-pdp-description`
- `glass`, `plastic` — packaging meta line in `r-pdp-description`

### Group 4 — Reviews

`reviews.*` are normally written by Judge.me. Decide in pre-flight:
1. connect Judge.me on dev and let it sync (faithful), or
2. write `reviews.rating` / `reviews.rating_count` directly for a handful of products
   so the stars render — a clear stub, and it will be overwritten if the app is later
   connected.

### Group 5 — Product taxonomy (category)

Assign `product.category` on every seeded product. The theme reads it as a
`taxonomy_category` (`name`, `ancestors[]`) for the breadcrumb, and it is what unlocks
the `shopify.*` category attributes in Group 2. Mirror production's category per
product; do not invent categories.

### Group 6 — Combined listings (Scent)

WS2 Phase 3 needs one real combined-listing group: sibling products (one per scent)
presented as a single listing, so the Scent option's values carry `product_url` and the
picker renders a navigating dropdown.

⚠️ **Highest-uncertainty item in this document.** Combined Listings is a distinct
Shopify feature with its own eligibility/setup (app- and plan-dependent), and its
availability is unconfirmed on both stores. Resolve this in pre-flight. If unavailable
on dev, seed the sibling scent products anyway and record the gap, so Phase 3 is built
against whatever mechanism production actually uses.

### Group 7 — Selling plans (subscriptions)

WS2 Phase 4 binds a native toggle to `product.selling_plan_groups` (Loop in
production). Seed at least one product with a selling plan group. If Loop cannot be
installed on dev, a plain subscription selling plan group is sufficient — the theme
reads the native object, not Loop's API.

---

## Synthesis policy — where copy comes from

Short answer: **yes, copy can be synthesized** — and for Group 2 it must be, because
those fields do not exist in production. Prefer sources in this order:

**1. Derive from real production content (strongly preferred).**
Much of "Made with" is already present in production product descriptions. Real
example from `community-soap-grounded`:

```
KEY INGREDIENTS AND BENEFITS
Fair Trade, Organic Shea Butter - Helps seal in moisture
Grounding Hinoki - Adds a soft and gently smoky woodsy scent
Calming Lavandin - A gentle floral scent that lingers lightly
```

That parses directly into a `rocky.made_with` list — real data, merely restructured,
which is far better test data than anything invented. The same descriptions often
carry `Scent:` and `Best for:` lines that map to `rocky.scent` and `rocky.skin_type`:

```
Scent: Grounded
Best for: Normal - Combination Skin
```

**Do this first.** Parse the production `descriptionHtml`, extract these blocks, and
only fall back to generation for products where the pattern is absent.

**2. Generate, clearly marked.** Where a product has no such block, synthesize
brand-appropriate copy (short ingredient/benefit lines in Rocky's voice). Two rules:
- Keep it obviously plausible but **do not invent regulated specifics** — no
  concentrations, no allergen declarations, no therapeutic claims. Ingredient and
  allergen data is compliance-sensitive; `custom.ingredient_allergen` should be
  **mirrored from production, never generated**.
- Tag synthetic records so they are identifiable — e.g. add a `seed:synthetic` product
  tag, or prefix generated values. This is what makes rule 5 of the safety rails
  enforceable: nobody can mistake generated copy for approved product claims, and a
  later dev→prod sync can filter them out.

**3. Never sync back.** This data exists to exercise the theme. The dev store is not a
staging source for production content.

---

## The run — one continuous task

### Pre-flight (blocking; collect once, then do not stop again)

Answer all of these before the run begins. They are the only human inputs.

- [ ] **Source (read) store handle** — confirmed in writing: `______`
- [ ] **Target (write) store handle** — confirmed in writing: `______`
- [ ] `shopify store auth` succeeds against **both**; production token read-only if possible
- [ ] Smoke test: read one product from each. Abort if either fails.
- [ ] **Reviews:** connect Judge.me, or stub `reviews.*`? (Group 4)
- [ ] **Combined Listings:** available on dev? If not, approve the fallback. (Group 6)
- [ ] **Synthesis:** approve the policy above, including the `seed:synthetic` marker
- [ ] Target product count (default **30**) and the scratch dir for state/exports

### Then: run to completion, unattended

State lives in a scratch dir (**not** the repo — exports may be large and are not
source):

```
<scratch>/ws6/
  export.json      # raw production read
  queue.json       # work items + per-item status
  progress.log     # append-only, one line per item
```

The run is a single loop over a work queue. Everything is **idempotent and keyed on
product handle**, so the task can be killed and resumed at any point — on restart it
reloads `queue.json` and skips items already marked `done`.

**Setup (once, at the top of the run)**
1. Read all production product metafield **definitions** in `custom`, `global`,
   `rocky`, `shopify`. Create any missing on dev (additive; skip existing).
2. Create the **Group 2** definitions on dev (`rocky.made_with`, `rocky.skin_type`,
   `rocky.scent`) — new, so nothing to mirror.
3. Discover the real taxonomy attribute handles (esp. "Made with"); record them in
   `progress.log` for the write-back at the end.
4. Select the product slice (default 30) covering the cases below, and write
   `queue.json`.

**Slice must cover** — otherwise the WS2 checks stay unverifiable:
- a bar soap with full metafields (canonical case)
- a scent family for the combined listing
- a subscription product
- a `Best Seller`-tagged product
- edge cases: single-image product; a product with video/3D media; a gift card; an
  accessory (`r-pdp-description` branches on `product.type`)
- at least one product left **deliberately bare** — no metafields, no tags — to prove
  the gating guarantee still holds

**Per item, in a loop until the queue is empty**
For each product handle:
1. Read it fully from production (title, handle, descriptionHtml, productType, tags,
   category, options/variants incl. SKU + price, media, all metafields, selling plan
   refs) → append to `export.json`.
2. Derive Group 2 values from `descriptionHtml` per the synthesis policy; fall back to
   generation and mark `seed:synthetic`.
3. Upsert the product on dev by handle (`productSet`, or create + `metafieldsSet`).
   Re-running the same input must not create duplicates.
4. Attach media (CDN URLs are simplest — confirm they resolve from dev).
5. Set metafields (Group 1 mirrored + Group 2 derived/generated), tags, category.
6. Mark `done` in `queue.json`; append one line to `progress.log`.
7. On error: mark `failed` with the message, **continue to the next item** — do not
   abort the run. Failures are reviewed at the end.

**Finish (after the queue drains)**
8. Build the combined-listing scent group (Group 6), per the pre-flight decision.
9. Attach a selling plan group to one product (Group 7).
10. Apply the reviews decision (Group 4).
11. Write back the discovered taxonomy handles into `WS2-pdp-info-column.md` and the
    `key` setting on the `r-pdp-attribute` block in `templates/product.json`.
12. Emit a summary: seeded / skipped / failed counts, the synthetic-vs-derived split,
    and anything needing a human.

**Throughput:** use bulk operations for the production read; throttle dev writes and
prefer one product per mutation over giant batches — slower, but resumable and far
easier to debug.

---

## Verification — unblocks the WS2 checks that are currently impossible

Run with `shopify theme dev -e dev` on branch `ws2-pdp-info-column`:

1. **Accordion content appears** — Ingredients / Sustainability / How to use render
   real copy (today all three are empty).
2. **`r-pdp-attribute` positive path** — "Made with" renders a list in intro col B and
   "Skin type" renders inline after the variant picker. *This is the specific check
   WS2 could not perform.* Verify **both** the `shopify.*` primary and the `rocky.*`
   fallback resolve.
3. **Badge** — the `Best Seller` product shows the pill; others do not.
4. **Subtitle** — the scent line renders under the title on a combined-listing product.
5. **Breadcrumb** — shows the real category trail once `product.category` is assigned
   (today it falls back to `product.type`, e.g. "Bar Soap").
6. **Reviews** — stars + count render.
7. **Combined listing** — the Scent dropdown lists sibling scents and navigates between
   products; `Size` stays as buttons.
8. **Subscriptions** — the one-time/subscribe toggle appears and binds a selling plan.
9. **Negative case still passes** — the deliberately bare product renders with **no
   empty shells** (the WS2 gating guarantee must not regress).
10. `shopify theme check` — no new offenses vs the 32-warning baseline.

---

## Risks & gotchas

- **Wrong-store writes are the main risk** — handles are confusingly similar and
  `rocky-soap-development` is labelled *production* in `shopify.theme.toml`. Consider
  two separate authenticated shells to keep them physically distinct.
- **`global.Instructions` is case-sensitive.**
- **Do not generate `custom.ingredient_allergen`** — compliance-sensitive; mirror only.
- **Metafield type drift** — mirror production types exactly.
- **API rate limits** — bulk read, throttled writes.
- **Idempotency** — key upserts on `handle` so the task is resumable.
- **Media** — copying imagery to a dev store is normally fine; large catalogues copy
  slowly. Confirm CDN URLs resolve cross-store.
- **Keep exports out of the repo** — scratch dir only.
- **Combined Listings availability** is unconfirmed — research, then build.

## Deliverables

- Group 1 definitions mirrored; **Group 2 definitions created** on dev.
- ~30 seeded products covering the slice above, including one deliberately bare.
- `rocky.made_with` / `rocky.skin_type` / `rocky.scent` populated — derived from
  production descriptions where possible, generated and marked `seed:synthetic`
  otherwise.
- One combined-listing scent group (or a documented gap + fallback).
- One product with a selling plan group.
- `WS2-pdp-info-column.md` updated: taxonomy handles filled in, "dev-store data gap"
  closed, Phase 2 positive-path checks marked verified.

---

## RUN RECORD — completed 2026-07-21

**Stores (confirmed in pre-flight, then verified by shop query):**
- Source (READ-ONLY, `read_products`/`read_metaobjects` token): **`rocky-soap-development`**
  → primary domain `www.rockymountainsoap.com`, Shopify Plus, 604 products. This is
  production despite the dev-style handle.
- Target (WRITE): **`rocky-horizon-development`** → "Shopify Plus App Development", 300
  products. All mutations went here; a code-level guard in the run wrapper refused any
  mutation against the source.

**Key discovery — this was ENRICHMENT, not creation.** The dev store already held
58/60 sliced products *with* media, variants and production tags, but *without* the
theme-consumed metafields/category. So the WS2 blocker was metadata, not products. The
run set metafields, category, taxonomy-scent refs and tags on existing products (no
`productSet` rebuild, no media copy).

**Results (60-product slice):**
- Definitions: 9 created + 2 standard (`reviews.*`) enabled + 3 `rocky.*` created.
- Products enriched: **58 done**. The 2 "failures" (`bath-bombs`, `gift-card`) are
  finish-phase special cases, both then handled.
- Synthesis split: **18 derived** from real production copy, **35 generated**
  (`seed:synthetic`), 4 legitimately empty (accessories/gift), 1 **bare control**
  (`blood-orange-grapefruit-body-butter`, no metafields — gating guarantee holds).
- Group 2 `shopify.*` **primary path** exercised: 16 `shopify--fragrance` metaobjects on
  18 products (`shopify.scent`) + `suitable-for-skin-type` on `perfect-pair-box`.
- Combined listing: `bath-bombs` parent + 8 scent children (ACTIVE).
- Reviews: 54 mirrored verbatim from production + 4 stubbed.
- Badge bug fixed: production uses `best-sellers`/`best-seller`, never `Best Seller`;
  Shopify silently drops space-containing tags. Badge repointed to `best-sellers` with
  label "Best Seller" (template + block default/preset).
- `templates/product.json`: skin-type `key` corrected to `suitable-for-skin-type`;
  made-with `key` left blank (no such taxonomy attribute — `rocky.made_with` is the path).

**Documented gaps (need a human / interactive step):**
- **Selling plan (Group 7 / Phase 4).** BLOCKED: `sellingPlanGroupCreate` needs
  `write_own_subscription_contracts`, which the CLI `store auth` app cannot grant here
  (OAuth `missing_shopify_permission`). Install a subscription app or use a custom-app
  token with the scope, then attach a group to one product.
- **`shopify theme dev -e dev` renders the WRONG store.** `shopify.theme.toml`
  `[environments.dev].store = "rocky-test-store"`, but the seeded store is
  `rocky-horizon-development`. To see the seeded data either repoint that environment or
  run `shopify theme dev --store rocky-horizon-development.myshopify.com`.

**Verification status:** the **data layer** is verified via Admin GraphQL (metafields
resolve with correct `jsonValue`, combined listing built, categories set, reviews
present). The **visual** positive-path checks in the Verification section still need a
`shopify theme dev` pass against the seeded store (see the store-mismatch gap above);
`theme check` holds at the 32-warning baseline (no new offenses).
