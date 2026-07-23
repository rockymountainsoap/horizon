# r-media — QA & testing runbook

How to test the media framework (`assets/r-media.js` + `snippets/r-media.liquid`).
Companion to `.cursor/references/r-media-framework.md`; QA matrix originates in
`.cursor/plans/WS9-media-framework.md`.

## Automated checks (run per change)

```sh
shopify theme check --fail-level error   # warnings baseline: compare counts, see memory note on ValidSchemaTranslations noise
bash scripts/check-importmap.sh          # every @theme/* import must resolve
node --check assets/r-media.js
grep -c "console\." assets/r-media.js                       # expect 0
grep -nE "^\s*--color-[a-z-]+:" snippets/r-media.liquid     # expect none (reserved namespace)
git diff --name-only main | grep -f <(sed -n 's/^| *[0-9]* | `assets\/\(.*\)` .*/assets\/\1/p' .cursor/references/engine-manifest.md)  # engine files: expect none
```

## Dev server

```sh
shopify theme dev -e dev     # rocky-test-store.myshopify.com, serves the LOCAL tree
# preview: http://127.0.0.1:9292
```

`theme dev` serves local templates/sections with hot reload — local JSON edits
affect only the dev preview theme, never the live theme.

## Seeding media (the blocker to know about)

**As of 2026-07, no template JSON in this repo has an image or video actually
picked** — heroes, media-with-content, and background media all fall through to
their placeholder branches, so `<r-media>` renders on no page by default. QA
requires seeding first. Options, best first:

1. **Disposable QA section (recommended)** — create `sections/r-qa-media.liquid`
   from the block below, add `{ "type": "r-qa-media" }` to a local template's
   section list (e.g. `templates/index.json`), QA, then revert both. **Never
   commit either edit** — and remember main auto-pushes, so keep even the
   branch clean of QA scraps. The section pulls real product media from the
   store, so nothing needs picking in the editor.
2. **Theme editor** — open the dev theme's editor (`shopify theme dev` prints
   the link) and pick images/videos on a hero. Persists into the dev theme's
   settings only; good for art-direction/editor-morph testing.
3. **PDP media** — products seeded by WS6 include video/3D edge cases, but the
   PDP gallery is Horizon's `deferred-media` chain, NOT r-media. Only useful
   for testing non-interference (a PDP video and an r-media video must not
   pause each other).

### QA section source (copy to `sections/r-qa-media.liquid`, do not commit)

```liquid
{% liquid
  # Scavenge real media from the store: first product image + first product video.
  assign qa_image = blank
  assign qa_video = blank
  for product in collections.all.products limit: 100
    if qa_image == blank and product.featured_image != blank
      assign qa_image = product.featured_image
    endif
    if qa_video == blank
      for media in product.media
        if media.media_type == 'video'
          assign qa_video = media
          break
        endif
      endfor
    endif
  endfor
%}

<div class="section section--full-width" style="display: grid; gap: 60vh; padding-block: 40vh;">
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>1 — image · fade-rise + blur-up (lazy)</h2>
    {% render 'r-media', image: qa_image, effect: 'fade-rise blur-up', loading: 'lazy', testid: 'qa-fade-blur' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>2 — image · ken-burns (needs pause control)</h2>
    {% render 'r-media', image: qa_image, effect: 'ken-burns', loading: 'lazy', testid: 'qa-kenburns' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>3 — image · parallax</h2>
    {% render 'r-media', image: qa_image, effect: 'parallax', loading: 'lazy', testid: 'qa-parallax' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>4 — video · autoplay loop (the default)</h2>
    {% render 'r-media', video: qa_video, testid: 'qa-video-auto' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>5 — video · autoplay off (click-to-play)</h2>
    {% render 'r-media', video: qa_video, autoplay: false, testid: 'qa-video-manual' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%;">
    <h2>6 — video · play once + replay</h2>
    {% render 'r-media', video: qa_video, loop: false, testid: 'qa-video-once' %}
  </div>
  <div style="max-width: 640px; margin-inline: auto; width: 100%; display: grid; gap: 8px;">
    <h2>7 — three stacked videos (concurrency cap: max 2 playing, 1 on low-power)</h2>
    {% render 'r-media', video: qa_video, testid: 'qa-cap-1' %}
    {% render 'r-media', video: qa_video, testid: 'qa-cap-2' %}
    {% render 'r-media', video: qa_video, testid: 'qa-cap-3' %}
  </div>
</div>

{% schema %}
{ "name": "R QA Media", "presets": [{ "name": "R QA Media" }] }
{% endschema %}
```

The 60vh gaps + 40vh padding make enter/leave scrolling unambiguous.

## Console probes (paste into DevTools, or drive via browser automation)

State of every instance:

```js
[...document.querySelectorAll('r-media')].map((m) => ({
  testid: m.dataset.testid,
  state: m.dataset.rState ?? 'image',
  effect: m.dataset.rEffect ?? null,
  armed: m.hasAttribute('data-r-armed'),
  inView: m.hasAttribute('data-r-in-view'),
  visible: m.hasAttribute('data-r-visible'),
  loaded: m.hasAttribute('data-r-loaded'),
  srcPromoted: Boolean(m.querySelector('source[src]')),
  videoPaused: m.querySelector('video')?.paused ?? null,
  toggleShown: m.querySelector('.r-media__toggle')?.hidden === false,
}))
```

Concurrency cap (with case 7 in view — expect ≤ 2 `false`):

```js
[...document.querySelectorAll('[data-testid^="qa-cap"] video')].map((v) => v.paused)
```

Bytes discipline — before any video enters the 400px preload margin, and for
`autoplay: false` / save-data always (Network panel, filter `.mp4|.m3u8`):
expect **zero** media requests; `<source>` elements have `data-r-src` but no
`src`.

## Behavior checklist (desktop browser)

| Check | Steps | Expect |
|---|---|---|
| Autoplay in view | Scroll case 4 into view | `data-r-state="playing"`, video crossfaded over poster, pause icon shown |
| Preload margin | Watch Network while scrolling toward case 4 | sources promoted ~400px before entry, playback only at ≥30% visible |
| Pause off-screen | Scroll case 4 fully out | `paused` state, `video.paused === true`; scroll back → auto-resumes |
| User pause is sticky | Click pause, scroll away and back | stays paused; only the button resumes it |
| Click-to-play | Case 5: no bytes until play pressed | `static` → press → `playing`; works with reduced motion on |
| Replay | Case 6: let it end | `ended` state, replay label ('Replay video'), press restarts |
| Entrance | Case 1 enters viewport | `data-r-visible` set after entry; fades/rises once (no repeat without `effect_repeat`) |
| Blur-up | Throttle network (Slow 3G), reload, scroll to case 1 | blurred LQIP visible immediately, real image crossfades on decode |
| Ken-burns | Case 2 in view | slow zoom runs only in view; toggle freezes/resumes it |
| Parallax | Scroll past case 3 slowly | gentle drift, no exposed edges, `will-change` only while `data-r-in-view` |
| Background tab | Play case 4, switch tab 60s, return | resumes cleanly; never stuck mid-crossfade (states are attribute-driven) |
| bfcache | Navigate away, browser Back | videos re-evaluate and resume (pageshow handler) |
| Autoplay blocked | Relaunch Chrome: `open -a "Google Chrome" --args --autoplay-policy=user-gesture-required` | `blocked` state: poster + play button; manual press plays |
| Reduced motion | macOS Reduce Motion, or DevTools → Rendering → emulate `prefers-reduced-motion` | no effects, no autoplay (`static`), play button still works |
| Reduced data | DevTools → Rendering → emulate `prefers-reduced-data` | `static`, zero video bytes until press |
| Console | Full scroll pass | no errors, no r-media logs |
| Editor morph | Theme editor: reorder/re-save a section with r-media | state re-derives, playback recovers (`updatedCallback`) |

## Device / assistive matrix (real hardware)

| Scenario | How | Expect |
|---|---|---|
| iOS Low Power Mode | iPhone, battery settings → Low Power | `blocked`: poster + play button; tap plays; no CLS |
| Android Data Saver | Chrome → Data Saver on | `static`, zero video bytes until tap |
| Low-power device | Old Android / DevTools CPU 6× throttle (`isLowPowerDevice`: ≤2 cores or ≤2GB) | cap = 1 playing; parallax/ken-burns stripped |
| Keyboard only | Tab through | toggle reachable, visible focus ring, Enter/Space toggles |
| VoiceOver (iOS + macOS) | swipe / VO-arrows | "Play video"/"Pause video"/"Replay video" announced; the video element itself is skipped (`aria-hidden`) |
| Cross-browser | Safari + Firefox full pass | parity; `navigator.connection` absent → optional-chaining path (no errors) |

## Performance gate

Lighthouse mobile ×3, before/after, on a page with an above-fold r-media video
and an effects-heavy page: LCP within noise of baseline (the poster is the LCP
for video heroes — the Liquid eager-guard strips opacity effects, verify no
above-fold element ever starts at `opacity: 0`), CLS = 0, INP unchanged.
Performance-panel scroll trace: no long tasks from the parallax loop (single
rAF, cached geometry, write-only frames).

## Known QA-environment quirks

- Background Chrome tabs freeze rendering — assert end-states via attributes
  (`data-r-state`), never by watching a transition finish (see memory:
  hidden-tab CSS transition freeze).
- `display: none` media (e.g. hero's desktop/mobile wrappers) never intersect —
  hidden-breakpoint videos must never load bytes; check both breakpoints.
- The dev store's placeholder-branch pages (empty pickers) are expected to show
  Horizon placeholder SVGs with no `<r-media>` at all — that's the correct
  fallback, not a bug.
