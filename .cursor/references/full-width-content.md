# Full-width & premium bleed content

How to make content span the viewport in this theme — sections, blocks, and
deeply nested elements. Read the decision table first; most needs are one class
or one schema setting, with no custom CSS at all.

Related: page shell tokens live in the **GLOBAL PAGE SHELL** block at the top of
`assets/r-base.css`.

---

## Decision table

| I want… | Use | Applies to |
|---|---|---|
| A whole section edge-to-edge (background **and** content) | `content_width: content-full-width` schema setting → root class `section--full-width` | section |
| A section that is full-width but keeps content on the gutters | `section--full-width section--full-width-margin` | section |
| One **direct child** of `.section` to break out | `class="force-full-width"` | direct child only |
| Content to reach only the **right** edge (carousels, peek slides) | `section--page-width section--full-width-right` | section |
| Full-width on **mobile only** | `section--mobile-full-width` | section |
| **Deeply nested** content to bleed (inside a group block, card, snippet) | `class="r-bleed"` (Rocky) | any depth |
| A carousel whose slides peek into the gutter | `padding-inline: var(--util-page-margin-offset)` | carousel |

**Rule of thumb:** prefer the grid mechanisms (rows 1–5). They are driven by the
section grid, so they are exact and immune to scrollbar rounding. Reach for
`.r-bleed` only when the content cannot be a direct child of `.section`.

---

## The mental model

Every `.section` is a three-column grid:

```
┌──────────┬───────────────────────────────┬──────────┐
│  margin  │        centre column          │  margin  │
│  (gutter)│  --full-page-grid-central-…   │ (gutter) │
└──────────┴───────────────────────────────┴──────────┘
     1                    2                      3
```

- `.section > *` defaults to `grid-column: 2` — the centre column.
- Going full width means spanning `1 / -1` instead.

That is literally all the grid classes below do.

---

## 1. Whole section full width

Add the setting to the section schema:

```json
{
  "type": "select",
  "id": "content_width",
  "label": "t:settings.width",
  "options": [
    { "value": "content-center-aligned", "label": "t:options.page" },
    { "value": "content-full-width", "label": "t:options.full" }
  ],
  "default": "content-center-aligned"
}
```

Map it to the class on the section root:

```liquid
{% liquid
  case section.settings.content_width
    when 'content-center-aligned'
      assign content_width = 'page-width'
    when 'content-full-width'
      assign content_width = 'full-width'
  endcase
%}

<div class="section section--{{ content_width }} color-{{ section.settings.color_scheme }}">
  …
</div>
```

Hardcode `section--full-width` instead when the layout is always full-bleed
(that is what `sections/hero.liquid` does for its media).

## 2. One direct child breaks out

No setting needed — upstream ships this:

```liquid
<div class="section section--page-width">
  <div class="prose">…normal page-width copy…</div>
  <div class="force-full-width">…edge-to-edge image band…</div>
</div>
```

`.section > .force-full-width { grid-column: 1 / -1; }`

⚠️ **Direct children only.** One wrapper in between and it silently stops
working — the rule is `.section > .force-full-width`. If you cannot restructure,
use `.r-bleed`.

## 3. Deeply nested content — `.r-bleed`

```liquid
<div class="r-bleed">…full-bleed media…</div>
<div class="r-bleed r-bleed--padded">…bleeds, content stays on the gutters…</div>
<div class="r-bleed r-bleed--mobile-only">…bleeds on mobile, page-width ≥750px…</div>
<div class="r-bleed r-bleed--desktop-only">…page-width on mobile, bleeds ≥750px…</div>
```

Implementation is `width: 100vw; margin-inline: calc(50% - 50vw)`, which
re-centres the box on the viewport regardless of nesting depth. Verified
edge-to-edge at depth 1 and depth 3.

**Constraint:** the containing block must be horizontally **centred** in the
viewport. True for section centre columns. *Not* true inside an off-centre
sub-column — e.g. the PDP details sidebar — where it lands skewed. Bleed from a
centred ancestor instead.

---

## Gutters & page shell

All of it is tunable from `:root` in `assets/r-base.css`:

| Token | Default | Controls |
|---|---|---|
| `--r-shell-max-width` | `150rem` | Max content width (excl. gutters) |
| `--r-shell-gutter` | `16px` | Side gutter below 750px |
| `--r-shell-gutter-desktop` | `20px` | Side gutter at/above 750px |
| `--r-shell-sidebar-width` | `25rem` | PDP info column, 750–1199px |
| `--r-shell-pdp-media-col` | `2fr` | PDP gallery share, ≥1200px |
| `--r-shell-pdp-details-col` | `1fr` | PDP info share, ≥1200px |

These reassign upstream's `--page-content-width` / `--page-margin` /
`--page-width` / `--sidebar-width`, so **every** section, grid, and bleed
utility follows automatically. The theme editor's *Page width* setting is
intentionally inert — the CSS override always wins.

Why CSS and not the theme editor: `config/settings_data.json` is merchant-owned
and excluded from `shopify theme push`, so a width chosen there never ships with
the code. See the comment block in `r-base.css` for the full rationale.

---

## Gotchas (all verified, not theoretical)

- **Do not use `--full-page-margin-inline-offset` for general bleeding.** It is
  scoped to Marquee's context. Applied to ordinary centre-column content it
  overshoots by one gutter on each side (measured −20px / +20px past the
  viewport) and introduces a horizontal scrollbar.
- **`.force-full-width` is direct-children-only** (see above).
- **`100vw` includes the classic scrollbar** on platforms that reserve space for
  it (Windows). A bleed can then overflow by the scrollbar width. Where that
  matters, put `overflow-x: clip` on a wrapping ancestor.
- **Full-bleed media still needs sane art direction.** Edge-to-edge imagery
  crops hard at narrow widths — set a sensible `aspect_ratio`, and remember that
  `constrain_to_viewport` caps height and can letterbox an image *inside* its
  container (this was the cause of the PDP gallery's phantom side gaps).
- **Backgrounds vs content.** `.section-background` is a separate absolutely
  positioned sibling; a section background is already full-bleed even when the
  content is page-width. Do not make a section full-width just to get an
  edge-to-edge background.
