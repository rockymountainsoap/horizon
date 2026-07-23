# WS9 — Rocky Media Framework (`r-media`)

Status: in progress (2026-07). Owner: front-end. Branch: `ws9-media-framework`.

## Why

Rocky wants a unified, elevated media-serving layer: performant responsive images and
auto-playing video with a dreamy scroll-intersection style. Today:

- No viewport-based video play/pause exists anywhere — hero/slideshow videos autoplay
  unconditionally and never pause off-screen; PDP/Video-block videos are click-to-play
  via `deferred-media`.
- Poster/deferral logic is duplicated across `video.liquid`, `background-media.liquid`,
  `_slide.liquid`, `_layered-slide.liquid`.
- No video path gates autoplay on `prefers-reduced-motion`, and autoplaying media lacks
  the pause control required by `.cursor/rules/animation-accessibility.mdc` (WCAG 2.2.2).

None of the touched files are in the engine manifest — the space is fully Rocky-owned.
Zero external dependencies (native APIs only). Design references (patterns, not code):
GSAP ScrollTrigger/Locomotive (enter/leave + scroll-progress choreography), Mux/Cloudinary
players (poster-first, `play()` promise as autoplay oracle, graceful blocked state),
Medium-style LQIP blur-up, Apple product-page pacing.

## Decisions (confirmed with Henry)

- Full dreamy effect suite: `fade-rise`, `blur-up`, `parallax`, `ken-burns`.
- Rollout: framework + pilots (hero, media-with-content chain, background media).
  Slideshow / PDP gallery / journal follow later on the same primitives.
- **Code-only** — no theme-editor settings; effects chosen per call site.
- Native Shopify-hosted video only. YouTube/Vimeo stay on `deferred-media`
  (`snippets/video.liquid`) unchanged.

## Architecture

One custom element `<r-media>` (image and video variants branch on refs):

- `assets/r-media.js` — `RMedia extends Component` (`@theme/component`) + module-level
  singletons: nearObserver (preload, rootMargin 400px bottom), viewObserver (play/effects,
  threshold [0, 0.3]), playing-set concurrency cap (2, or 1 on low-power devices),
  parallax set + one self-suspending rAF loop (r-sticky-sidebar write discipline).
- `snippets/r-media.liquid` — the Liquid API, markup contract, all component CSS in
  `{% stylesheet %}`, inline `<script type="module">` loader.
- `assets/r-base.css` — `--r-motion-*` token block only (shared motion vocabulary).
- No importmap entry: r-media only imports `@theme/component` / `@theme/utilities` and
  nothing imports it by specifier.
- Never dispatches/listens to `MediaStartedPlayingEvent`: r-media plays only muted
  ambient loops, so non-interference with user-initiated `deferred-media` audio is the
  correct integration.

### Markup contract

```html
<r-media class="r-media r-media--natural" data-r-effect="fade-rise parallax"
         data-r-autoplay data-r-loop data-r-state="idle"
         style="--r-media-aspect: 1.5; --r-media-lqip: url('…width=32');">
  <div class="r-media__drift" ref="drift">
    <img class="r-media__el r-media__poster" ref="poster" …>
    <video ref="video" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1">
      <source data-r-src="…" type="…" ref="sources[]">
    </video>
  </div>
  <button type="button" class="r-media__toggle" ref="toggle" on:click="/toggleMotion" hidden>…</button>
</r-media>
```

- Poster is a real responsive `<img>` under the video (no `poster` attribute):
  poster-first LCP, zero CLS, video crossfades over it on `playing`.
- LCP guard in Liquid: when resolved `loading == 'eager'`, `fade-rise`/`blur-up` are
  stripped from `effect` (never render the LCP candidate at opacity 0).
- Three layers so entrance (element) / parallax (drift wrapper) / ken-burns (media el)
  never fight over one `transform`.

### Autoplay decision ladder (`data-r-state`: idle → ready → playing ⇄ paused; blocked / static / ended)

1. `autoplay: false` → `static` (poster + play button; press promotes sources + plays).
2. `prefersReducedMotion()` → `static`, no effects; play button remains (explicit
   activation overrides the preference).
3. `navigator.connection?.saveData` or `(prefers-reduced-data: reduce)` → `static`;
   zero video bytes until tap.
4. `isLowPowerDevice()` → autoplay allowed, cap = 1, parallax/ken-burns removed.
5. Near viewport → promote `data-r-src` → `src`, `load()` → `ready`. ≥0.3 visible →
   `await play()`: resolve → `playing` (FIFO-pause oldest over cap); reject → `blocked`
   (poster + play button; manual press retries — the gesture satisfies policy).
6. Ratio 0 → system pause; re-entry auto-resumes unless the user paused.
7. `visibilitychange` hidden → pause all; visible → re-evaluate. `pageshow` (bfcache) →
   full re-evaluation.
8. `loop: false` + `ended` → replay affordance.

Frozen-tab discipline: no `transitionend`/`animationend` in the state machine — every
end-state is a direct consequence of `data-r-state`; transitions are decorative.

### Effects

JS-set attributes: `data-r-visible` (entrance), `data-r-in-view` (compositor gating:
`will-change`, ken-burns play-state, parallax membership), `data-r-loaded` (blur-up),
`data-r-motion-paused` (toggle on stills).

Tokens (r-base.css): `--r-motion-duration-reveal: 750ms`, `--r-motion-duration-crossfade:
350ms`, `--r-motion-duration-kenburns: 18s`, `--r-motion-ease-drift:
cubic-bezier(0.22, 1, 0.36, 1)`, `--r-motion-ease-soft: var(--ease-out-cubic)`,
`--r-motion-rise-distance: 1.5rem`, `--r-media-parallax-range: 6%`,
`--r-media-kenburns-scale: 1.12`.

- fade-rise: opacity + translate transition on `[data-r-visible]`.
- blur-up: 32px LQIP (inline CSS `url()`) on `::before` with `blur(20px) scale(1.1)`;
  real img crossfades on `[data-r-loaded]`.
- parallax: JS-only rAF (Safari <26 lacks scroll-driven animations; JS unifies gating).
  Drift wrapper carries base `scale(1.08)` so drift never reveals edges.
- ken-burns: CSS keyframes, alternate infinite 18s, paused unless `[data-r-in-view]`;
  gets the same toggle control (>5s auto-motion, WCAG 2.2.2).

All effect motion lives inside `@media (prefers-reduced-motion: no-preference)`.

## Pilots (no schema changes)

1. `sections/hero.liquid` — media slots 1/2 (images, picture art-direction, 4 video_tag
   sites) → r-media `aspect: 'fill'`. No entrance effects (LCP surface). Blurred
   decorative captures stay raw.
2. `snippets/media.liquid` — image branch → r-media (`fade-rise blur-up`); video branch:
   external host keeps `render 'video'`, uploaded → r-media honoring block
   `video_autoplay`/`video_loop`.
3. `snippets/background-media.liquid` — signature and `video-background--*` classes
   frozen; both branches → r-media. Then remove the `video-background.js` loader from
   `snippets/scripts.liquid`, delete `assets/video-background.js`, log in
   `WS7-feature-js-triage.md`.

## Accessibility

- Per-instance toggle button, always reachable: `accessibility.play_video`/`pause_video`
  plus new `rocky.media.replay_video|pause_motion|play_motion` keys. ~0.65 opacity at
  rest, full on hover/`:focus-visible`, ≥44px touch target.
- `<video>` is `aria-hidden="true" tabindex="-1"`; poster img carries the real alt
  (empty for backgrounds).
- background-media's reduced-motion `display: none` is replaced by the `static` state
  (poster + play control) — an upgrade from hiding.

## Verification

Automated: `shopify theme check` (compare ValidSchemaTranslations count to baseline),
`bash scripts/check-importmap.sh`, grep-audit (no console.log / raw hex / `--color-*`
definitions / engine files touched).

Manual QA matrix (dev theme): iOS Low Power Mode → blocked state; Chrome
`--autoplay-policy=user-gesture-required`; Data Saver + `prefers-reduced-data`;
reduced motion; viewport play/pause + 400px preload; concurrency cap (3 stacked videos);
background tab + bfcache; keyboard + VoiceOver; theme-editor morph re-init;
Safari/Firefox parity; Lighthouse mobile ×3 before/after (LCP within noise, CLS 0,
INP flat).

## Commit sequence

1. This plan doc.
2. Framework core, inert (r-media.js, r-media.liquid, tokens, locale keys).
3. Pilot 1: hero.
4. Pilot 2: media-with-content.
5. Pilot 3: backgrounds + video-background.js retirement.
6. `.cursor/references/r-media-framework.md` + tuning.
