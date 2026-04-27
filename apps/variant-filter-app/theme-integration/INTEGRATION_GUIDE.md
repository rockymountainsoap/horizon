# Variant Filter App — Theme Integration Guide

Applies to any Horizons-based Shopify theme (Online Store 2.0).

---

## Prerequisites

1. The Variant Filter app is installed on your store.
2. The TAE has been deployed: `shopify app deploy` from `apps/variant-filter-app/`.
3. Confirm the snippet exists in your active theme — look for
   `snippets/variant-filter--filter.liquid` and
   `snippets/variant-filter--precheck.liquid` in the Theme Editor file browser.
   If absent, redeploy: `shopify app deploy`.

---

## Files to edit

| File | Path | Rendering path |
|---|---|---|
| Swatch circles | `snippets/variant-swatches.liquid` | blocks/swatches.liquid → render 'variant-swatches' |
| Pill buttons + dropdowns | `snippets/variant-main-picker.liquid` | blocks/variant-picker.liquid → render 'variant-main-picker' |

---

## Step 1 — Register files (Rocky fork only)

Add to `.gitattributes`:
```
snippets/variant-swatches.liquid    merge=ours
snippets/variant-main-picker.liquid merge=ours
```

Add rows to `.cursor/references/gitattributes-merge-strategy.md`.

Run once per developer machine:
```bash
git config merge.ours.driver true
```

---

## Step 2 — Edit `snippets/variant-swatches.liquid`

### 2a — Outer loop precheck

Search for:
```
for product_option in product_resource.options_with_values
```

Add the following **immediately after** that `for` line:

```liquid
{%- # variant-filter app — pre-check: bypass filter if no values match this product -%}
{%- capture vf_bypass_signal -%}
  {%- render 'variant-filter--precheck', product_option: product_option -%}
{%- endcapture -%}
{%- assign vf_bypass = false -%}
{%- if vf_bypass_signal == 'bypass' -%}{%- assign vf_bypass = true -%}{%- endif -%}
```

### 2b — Inner loop filter

Search for the **one** occurrence of:
```
for product_option_value in product_option.values
```

Add the following **immediately after** that `for` line:

```liquid
{%- # variant-filter app — skip values excluded by the collection rule -%}
{%- capture vf_skip -%}
  {%- render 'variant-filter--filter',
      product_option: product_option,
      product_option_value: product_option_value,
      vf_bypass: vf_bypass -%}
{%- endcapture -%}
{%- unless vf_skip == 'skip' -%}
```

Add the following **immediately before** the matching `endfor`:

```liquid
{%- endunless -%}
```

---

## Step 3 — Edit `snippets/variant-main-picker.liquid`

This file has **two** inner loops — both need patching, plus one outer loop precheck.

### 3a — Outer loop precheck

Search for:
```
for product_option in product_resource.options_with_values
```

Add the same 4-line precheck block from Step 2a immediately after.

### 3b — Buttons / pill branch (first inner loop)

Search for the **first** occurrence of:
```
for product_option_value in product_option.values
```

It appears inside a `<fieldset>` element. Add the 5-line filter block immediately after, and `{%- endunless -%}` before the matching `endfor`.

### 3c — Dropdown branch (second inner loop)

Search for the **second** occurrence of:
```
for product_option_value in product_option.values
```

It appears inside a `<select>` element. Add the same filter block + endunless.

---

## Step 4 — Verify

```bash
# Should return 3 matches (one per patched inner loop):
grep -c "vf_skip" snippets/variant-swatches.liquid snippets/variant-main-picker.liquid
```

---

## Step 5 — Test

1. Set a test rule in the admin app (e.g. exact, option "Size", values ["100ml"]).
2. Visit the collection on a development theme — only 100ml values should appear.
3. Visit a collection with no rule — all variants render normally.
4. Visit a non-collection page — all variants render normally.

---

## Re-applying after a theme update

With `merge=ours` in `.gitattributes`, Git preserves your edits on merge.

If files were overwritten (no `merge=ours`, or direct theme pull):

1. Search each file for the `vf_skip` / `vf_bypass_signal` markers.
2. If missing, re-insert from the code blocks in Steps 2–3.
3. Confirm the TAE snippet name (`variant-filter--filter`) still matches the
   deployed extension handle. If the handle changed, update all `render` calls.

**Upstream diff checklist after each Horizons update:**

- [ ] `variant-swatches.liquid`: outer + inner loop structure unchanged?
- [ ] `variant-main-picker.liquid`: buttons inner loop structure unchanged?
- [ ] `variant-main-picker.liquid`: dropdown inner loop structure unchanged?
- [ ] No new variant rendering style introduced (e.g. a third branch)?
