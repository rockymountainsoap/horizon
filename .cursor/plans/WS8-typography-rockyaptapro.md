# WS8 — Typography: RockyAptaPro theme-wide (self-hosted, Figma-exact)

## Context

The theme rendered **all** type from the Shopify Font Library via `font_picker`
settings (Inter, cross-origin, `font-display: swap`) — no self-hosted font scaffolding
existed. This workstream self-hosts Rocky's brand face **RockyAptaPro** as the theme-wide
font with the smallest possible footprint, removes the dead Inter downloads, eliminates
font-load layout shift (CLS), and aligns the type system to the Figma retheme
("Rocky Retheme 2026", file `3ZAtk6RatEDFpRRDahJopW`).

Decisions (confirmed with stakeholder): one family only; sizes reproduce Figma's fixed px
but the smallest running-text tier is floored to ~12px for legibility; this pass ships the
theme-wide font + global type scale + exact PDP parity (Home/PLP still run stock Horizon
sections — they inherit the global baseline and get pixel-exact parity when rebuilt);
subset to EN+FR+currency keeping the full weight axis.

---

## What shipped

### 1. The font — one file, subset + optimised (Part A)
Source: `/Users/henry.b/Documents/Rocky/Webfonts/RockyAptaPro-Var.woff2` (variable).

Measured with `fonttools`/`pyftsubset` (throwaway venv):
- **Axes:** `wght` **100–800** (default 400) **and** `ital` 0–8 (6 italic masters).
- The Figma design uses **zero italics**, so the **`ital` axis was instanced out**
  (`fonttools varLib.instancer ital=0`) — the single biggest size win.
- Glyph-subset to EN + FR + punctuation + currency
  (`U+0000-00FF,U+0100-017F,U+0180-024F,U+2000-206F,U+20A0-20BF,U+2018-201F,U+2026,U+2032-2033,U+2122`,
  `--layout-features='*'` to keep kerning/ligatures). Verified `$ £ € é è à ç ê î ù û ÿ œ Œ « » ' ' — …` all present; wght axis intact.

| Build | Bytes | vs original |
|---|---|---|
| original (both axes, full glyphs) | 109,940 | — |
| glyph-subset, both axes | 82,780 | −25% |
| **glyph-subset + no italic axis (shipped)** | **51,804** | **−53%** |

→ `assets/RockyAptaPro-Var.woff2` (51.8 KB), all weights 100–800. Real italics dropped
(faux-italic synthesises if ever needed — design uses none).

### 2. Self-host + preload + zero-CLS fallback (Part B)
- **`snippets/r-fonts.liquid`** (new): `@font-face` for the variable font
  (`font-weight: 100 800; font-display: swap`), a **metric-matched fallback** `@font-face`
  (`size-adjust: 103.6%` — advance-matched to local Arial so wrapped text keeps the same
  line breaks; `ascent-override: 95%; descent-override: 30%; line-gap-override: 0%` from
  RockyAptaPro's own metrics, upm 1000 / typo asc-desc 950/-300 — pins the line box), and
  the `:root` family + type-scale overrides.
- Rendered in `layout/theme.liquid` **immediately after `theme-styles-variables`** so its
  `:root` wins the cascade over the picker-generated tokens.
- **`snippets/fonts.liquid`**: the four Inter `font_url` preloads replaced by **one**
  `<link rel="preload" as="font" … crossorigin fetchpriority="high">` for the brand font.
  Removing the Inter preloads is the main site-speed win (no dead cross-origin bytes).

### 3. Theme-wide swap + bugfix (Part C)
- All four source families (`--font-{body,subheading,heading,accent}--family`) point at the
  RockyAptaPro stack → cascades to every heading, paragraph, button, cart. The picker's
  Inter `@font-face` is now unused → **no download** (harmless dead CSS; generator left
  intact, pickers are a cosmetic fallback).
- Fixed latent bug `assets/r-base.css`: `--r-font-display` referenced the undefined
  `--font-primary--family` → now `var(--font-heading--family)`.

### 4. Figma render parity (Part D)
- Global `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;` on
  `html` in `r-base.css` (base.css only had it on body text) so headings match the lighter
  Mac/Figma rendering.
- No special OpenType features (design exposes none); default kerning/ligatures kept.

### 5. Type scale — global + PDP (Part E)
Three-tier letter-spacing tokens in `r-base.css`: `--r-tracking-tight: 0.02em`
(running text + headings) · `--r-tracking-normal: 0.05em` (nav/labels) ·
`--r-tracking-wide: 0.10em` (wide uppercase micro-labels).

**Global (`r-fonts.liquid :root`)** — fixed px, weight **400**, tight tracking, no case:
h1 30 / h2 24 / h3 20 / h4 18 / h5 16 / h6 14 px; **paragraph 12px** (floored from Figma
11). Headings are deliberately Regular 400 per the design (a large, intended change from
the old Inter-Bold clamps).

**PDP (component parity):**
- `--r-pdp-value-size` 14→**12px** (body/price/controls, floored), `--r-pdp-label-size`
  13→**11px** (uppercase micro-labels), in `r-base.css`.
- Product title `<h1>` scoped to **18px/400** in `_product-details.liquid` (global h1 30px
  is for Home).
- Ad-hoc `letter-spacing` (0.06/0.08em) across `r-pdp-subtitle/badge/guarantees/attribute`
  + `r-pdp-subscribe` → the tier tokens (badge = wide, rest = normal).
- Hardcoded `font-weight: 600` → **500** (Figma emphasis) in `r-pdp-attribute`,
  `r-pdp-find-in-store`, `r-pdp-subscribe`.

---

## Files changed
- `assets/RockyAptaPro-Var.woff2` — **new**, 51.8 KB subset variable font
- `snippets/r-fonts.liquid` — **new**, @font-face + fallback + :root tokens
- `snippets/fonts.liquid` — single RockyAptaPro preload (Inter preloads removed)
- `layout/theme.liquid` — render `r-fonts` after `theme-styles-variables`
- `assets/r-base.css` — smoothing; `--r-tracking-*`; `--r-font-display` fix; PDP type tokens
- `blocks/_product-details.liquid` — PDP `<h1>` 18px scope
- `blocks/r-pdp-{subtitle,badge,attribute,guarantees,find-in-store}.liquid`,
  `snippets/r-pdp-subscribe.liquid` — tracking tiers + weight fixes

No engine-manifest file touched. No `settings_schema.json`/`settings_data.json` change.
theme-check: no new offenses (the one AssetPreload is suppressed as the original was).

## Verification (run before deploy)
1. `shopify theme dev -e dev`; open Home, a PDP, a PLP.
2. Network → Font: exactly one request (`…/assets/RockyAptaPro-Var.woff2`), no
   Inter / fonts.shopifycdn.com; preload fetched early.
3. Lighthouse/Perf, Slow 3G: CLS ≈ 0, text visible immediately, no reflow on swap.
4. PDP vs Figma `632:1191`: title 18/400, body 12/400, review titles 500, tracking tiers,
   uppercase labels.
5. `/fr`: accents + currency render in RockyAptaPro (no tofu).
6. Tune `size-adjust` (currently 103.6%) by visual diff if any swap shift remains.

## Follow-ups
- Home/PLP pixel-exact parity + the mobile-only 24px review pull-quote land when those
  sections are rebuilt as Rocky sections (separate WS).
- Real-italic support (second `@font-face` on the `ital` axis) only if a future design uses it.
