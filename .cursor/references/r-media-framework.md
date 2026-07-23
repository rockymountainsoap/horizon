# r-media — Rocky Media Framework (usage reference)

Living doc for `snippets/r-media.liquid` + `assets/r-media.js` (WS9).
Plan/rationale: `.cursor/plans/WS9-media-framework.md`.

## When to use what

| Media | Use |
|---|---|
| Image (any surface) | `{% render 'r-media', image: … %}` |
| Shopify-hosted (uploaded) video | `{% render 'r-media', video: … %}` |
| YouTube / Vimeo (`video_url` setting or `external_video` media) | `{% render 'video', … %}` (click-to-play `deferred-media`) — **not** r-media |
| PDP gallery media | Horizon gallery chain (`product-media.liquid` → `deferred-media`) — untouched |
| Placeholder (blank setting) | Caller renders `placeholder_svg_tag` itself; r-media renders nothing without a media object |

Current consumers: `sections/hero.liquid`, `snippets/media.liquid`
(media-with-content chain), `snippets/background-media.liquid` (groups, cards,
section backgrounds, password).

## Liquid API

```liquid
{% render 'r-media',
  image: block.settings.image,          | video: section.settings.video   (XOR)
  mobile_image: …,                      | art-direction <picture> source under 750px (image variant)
  aspect: 'natural',                    | 'natural' (default; box from media ratio) or 'fill' (caller sizes the root; layers cover)
  sizes: '(min-width: 750px) 60vw, 100vw',
  widths: '240, 352, …',                | srcset widths (canonical default)
  effect: 'fade-rise blur-up',          | space-separated: fade-rise · blur-up · parallax · ken-burns
  effect_repeat: true,                  | re-trigger entrance each viewport entry (default one-shot)
  autoplay: false,                      | video: default true (muted ambient); false → click-to-play poster
  loop: false,                          | video: default true; false → play once + replay control
  decorative: true,                     | empty alt (backgrounds)
  unset_focal: true,                    | neutralize image focal point (contain layouts)
  loading: 'lazy', fetchpriority: 'auto', | defaults from section.index (1 → high; ≤3 → eager)
  section: section,                     | pass whenever available — enables the index defaults
  class: 'my-host-class',
  testid: 'my-testid'
%}
```

## Behavior contract

- **Autoplay ladder** (video): reduced motion, `saveData`, `prefers-reduced-data`,
  or `autoplay: false` → `static` (poster, zero video bytes, play button).
  Otherwise sources promote (`data-r-src` → `src`) ~400px before the viewport,
  playback starts at ≥30% visibility (or ≥50% viewport coverage for tall
  media), pauses when fully off-screen, resumes on re-entry. A rejected
  `play()` (iOS Low Power Mode, policy) → `blocked`: poster + play button, and
  the user's press satisfies the gesture requirement. Max 2 videos play
  concurrently (1 on low-power devices), FIFO.
- **States** mirror to `data-r-state`: `idle → ready → playing ⇄ paused`,
  plus `blocked` / `static` / `ended`. All CSS end-states key off the
  attribute — never rely on transition completion (frozen background tabs).
- **User intent**: user pause blocks every auto-resume; user play overrides
  the automatic ladder (including reduced-motion — explicit activation) and
  survives viewport exits/re-entries.
- **Control**: every video and every armed ken-burns still gets the corner
  toggle (play/pause/replay, ≥44px, `visually-hidden` labels from
  `accessibility.play_video|pause_video` + `rocky.media.*`).
- **One-at-a-time bus**: r-media deliberately does NOT dispatch or listen to
  `MediaStartedPlayingEvent` — it only plays muted ambient loops, which must
  not pause a user-initiated PDP/deferred-media video.

## Effects

All motion lives in `@media (prefers-reduced-motion: no-preference)`; the
hidden initial states additionally require `data-r-armed` (JS present), so
no-JS and reduced-motion visitors always see the media. The Liquid layer
strips `fade-rise`/`blur-up` from eagerly loaded media (LCP guard) — don't
fight it; transform-only effects stay allowed above the fold.

| Token | What | Layer |
|---|---|---|
| `fade-rise` | soft entrance: opacity + 1.5rem rise, 750ms decelerate | root |
| `blur-up` | 32px LQIP glows under the poster until it decodes | `::before` + poster |
| `parallax` | scroll-linked drift (JS rAF writes `translate`; CSS `scale: 1.08` gives edge headroom) | `.r-media__drift` |
| `ken-burns` | 18s alternating zoom on stills, runs only in view, pause control | poster |

Layer separation is deliberate — entrance (root) / parallax (drift) /
ken-burns (poster) never fight over one transform. Tuning tokens live in
`assets/r-base.css` (`--r-motion-*`, `--r-media-parallax-range`,
`--r-media-kenburns-scale`).

## Gotchas

- `fill` mode does **not** position its own root — the caller sizes it (grid
  item class, `.r-background-media`, …). The inner layers cover absolutely.
- r-media is a wrapper, not a replaced element: host CSS that relied on an
  `<img>`'s intrinsic ratio needs `aspect-ratio: var(--r-media-aspect)` on the
  root (see hero's auto-height rule). `--r-media-aspect` is emitted in every
  mode.
- Override `object-fit` per host with `--r-media-fit` (see
  `media.liquid` / `background-media.liquid`), not by styling `.r-media__el`.
- Don't put `.video-background`-style `*` selectors on the root — they would
  absolutely position the toggle button's internals.
- No importmap entry exists for r-media; load it with the inline
  `<script type="module">` the snippet already emits. Add an importmap entry
  only if another module starts importing it by specifier.
- Section-renderer morphs reset `data-r-state` to the server's `idle`; the
  component re-derives everything in `updatedCallback` — keep new state
  JS-derived, never author server-side state other than `idle`.
