import { Component } from '@theme/component';
import { clamp, isLowPowerDevice, prefersReducedMotion, yieldToMainThread } from '@theme/utilities';

/**
 * <r-media> — Rocky media framework (WS9).
 *
 * One element serves both responsive images and Shopify-hosted ambient video:
 *   - viewport-driven autoplay/pause for muted looping video, with near-viewport
 *     source promotion (sources ship as `data-r-src`, `preload="none"`);
 *   - the dreamy effect vocabulary (`data-r-effect`: fade-rise, blur-up,
 *     parallax, ken-burns) — entrance and gating are JS-armed, the motion
 *     itself lives in CSS inside `@media (prefers-reduced-motion: no-preference)`;
 *   - the WCAG 2.2.2 pause/play/replay control for all auto-playing media.
 *
 * Playback state machine, owned here and mirrored to `data-r-state`:
 *   idle → ready → playing ⇄ paused, plus blocked / static / ended.
 * Every visual end-state derives from the attribute alone — transitions are
 * decorative, so a frozen background tab can never strand the UI mid-state.
 *
 * Deliberately NOT integrated with MediaStartedPlayingEvent: r-media only ever
 * plays muted ambient loops, which cannot conflict with audio from a
 * user-initiated `deferred-media` video (PDP, video block). Dispatching the
 * event would wrongly pause those. Non-interference is the integration.
 *
 * Rendered exclusively by snippets/r-media.liquid — see that file for the
 * markup contract, and .cursor/references/r-media-framework.md for usage.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} drift - parallax translate layer
 * @property {HTMLImageElement} [poster] - responsive poster/still image
 * @property {HTMLVideoElement} [video] - ambient video (video variant only)
 * @property {HTMLSourceElement[]} [sources] - video sources carrying data-r-src
 * @property {HTMLButtonElement} [toggle] - play/pause/replay control
 * @extends {Component<Refs>}
 */

/** Ratio of the element that must be visible before video plays. */
const PLAY_RATIO = 0.3;

/** Fraction of the viewport a tall element must cover to count as playable. */
const VIEWPORT_COVER_RATIO = 0.5;

/** How far outside the viewport video sources are promoted and loaded. */
const NEAR_MARGIN = '400px 0px';

/** Concurrent playing videos — iOS compositor/memory backstop. */
const MAX_PLAYING = isLowPowerDevice() ? 1 : 2;

/** All connected instances (visibilitychange / bfcache / preference resync). */
const instances = new Set();

/** Currently playing instances in FIFO order (Set preserves insertion order). */
const playing = new Set();

/** Promotes video sources and loads metadata just before the media is needed. */
const nearObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (entry.target instanceof RMedia) entry.target.prepare();
      nearObserver.unobserve(entry.target);
    }
  },
  { rootMargin: NEAR_MARGIN }
);

/**
 * Drives playback and effect gating. The dense low thresholds exist for media
 * taller than the viewport, whose intersection ratio can never reach
 * PLAY_RATIO — the viewport-coverage test in #onViewChange still needs
 * callbacks to run on.
 */
const viewObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.target instanceof RMedia) entry.target.onViewChange(entry);
    }
  },
  { threshold: [0, 0.1, 0.2, PLAY_RATIO] }
);

/** Parallax members currently in view; the rAF loop runs only while non-empty. */
const parallaxActive = new Set();

/** @type {number | null} */
let parallaxFrame = null;

function parallaxLoop() {
  parallaxFrame = null;
  if (parallaxActive.size === 0 || document.hidden) return;

  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  for (const media of parallaxActive) media.applyParallax(scrollY, viewportHeight);

  parallaxFrame = requestAnimationFrame(parallaxLoop);
}

function startParallaxLoop() {
  if (parallaxFrame === null && parallaxActive.size > 0) {
    parallaxFrame = requestAnimationFrame(parallaxLoop);
  }
}

class RMedia extends Component {
  /** True after the user explicitly paused — blocks every auto-resume path. */
  #userPaused = false;

  /** True after the user explicitly played — lets viewport re-entry resume a
   *  video that the automatic ladder (reduced motion, save-data) would skip. */
  #userActivated = false;

  /** Guards overlapping play() promises. */
  #playPending = false;

  /** Latest any-intersection state from the view observer. */
  #inView = false;

  /** Latest "visible enough to play" state (with exit hysteresis: playback
   *  only stops once the element fully leaves the viewport). */
  #playEligible = false;

  /** Cached document-space geometry for the parallax loop (no layout reads
   *  in the hot path). Refreshed on view entry and window resize. */
  #geometry = { top: 0, height: 0 };

  /** Max translateY in % of element height; half the CSS range token. */
  #parallaxAmplitude = 0;

  /** Last written parallax value, to skip no-op style writes. */
  #parallaxLast = '';

  /** @type {AbortController | undefined} */
  #listeners;

  /** Elements already wired with listeners — a morph may keep the same nodes,
   *  and re-running the init methods must not stack duplicates. */
  #wiredVideo = null;

  #wiredPoster = null;

  connectedCallback() {
    super.connectedCallback();

    this.#listeners = new AbortController();
    instances.add(this);

    // Low-power devices keep autoplay but shed the continuous-motion effects.
    if (isLowPowerDevice()) this.#removeEffects('parallax', 'ken-burns');

    this.#arm();
    this.#initVideo();
    this.#initBlurUp();

    viewObserver.observe(this);
    if (this.refs.video) nearObserver.observe(this);
  }

  disconnectedCallback() {
    this.#listeners?.abort();
    viewObserver.unobserve(this);
    nearObserver.unobserve(this);
    instances.delete(this);
    playing.delete(this);
    parallaxActive.delete(this);
    super.disconnectedCallback();
  }

  updatedCallback() {
    super.updatedCallback();
    // A section-renderer morph may have reset server-rendered attributes and
    // swapped subtree nodes; re-derive everything from the DOM.
    this.#arm();
    this.#initVideo();
    this.#initBlurUp();
    this.resync();
  }

  /**
   * Declarative `on:click="/toggleMotion"` handler for the control button.
   * Videos: pause / play / replay. Ken-burns stills: freeze / resume.
   * @param {Event} [event]
   */
  toggleMotion(event) {
    event?.preventDefault();

    const { video } = this.refs;
    if (!video) {
      this.toggleAttribute('data-r-motion-paused');
      return;
    }

    if (this.dataset.rState === 'playing') {
      this.#userPaused = true;
      this.#pause();
      return;
    }

    this.#userPaused = false;
    this.#userActivated = true;
    if (this.dataset.rState === 'ended') video.currentTime = 0;
    this.#tryPlay();
  }

  /** Promote `data-r-src` → `src` and load. Idempotent and morph-safe: reads
   *  the live DOM instead of trusting a flag. */
  prepare() {
    const { video, sources = [] } = this.refs;
    if (!video) return;

    // `static` promises zero video bytes (save-data, reduced motion, or
    // autoplay off) until the user explicitly presses play.
    if (this.dataset.rState === 'static' && !this.#userActivated) return;

    let promoted = false;
    for (const source of sources) {
      if (source.getAttribute('src') || !source.dataset.rSrc) continue;
      source.src = source.dataset.rSrc;
      promoted = true;
    }

    if (promoted) {
      video.load();
      if (this.dataset.rState === 'idle') this.#setState('ready');
    }
  }

  /**
   * View-observer callback.
   * @param {IntersectionObserverEntry} entry
   */
  onViewChange(entry) {
    const rootHeight = entry.rootBounds?.height || window.innerHeight;
    const coversViewport = entry.intersectionRect.height >= rootHeight * VIEWPORT_COVER_RATIO;

    this.#inView = entry.isIntersecting;
    this.#playEligible = entry.isIntersecting && (entry.intersectionRatio >= PLAY_RATIO || coversViewport);
    this.toggleAttribute('data-r-in-view', this.#inView);

    if (this.#inView) {
      this.#showEntrance();
    } else if (this.hasAttribute('data-r-effect-repeat')) {
      this.removeAttribute('data-r-visible');
    }

    this.resync();
  }

  /** Re-evaluate playback and parallax from the last known view state. Called
   *  on view changes, visibility/bfcache restores, and preference changes. */
  resync() {
    this.#syncParallax();
    this.#syncPlayback();
  }

  /** Pause without touching user intent — for visibilitychange and the
   *  concurrency cap. Viewport re-entry or tab return resumes automatically. */
  systemPause() {
    this.#pause();
  }

  /**
   * One parallax frame. Called by the module loop with values read once per
   * frame for all members; writes only when the rounded value changes.
   * @param {number} scrollY
   * @param {number} viewportHeight
   */
  applyParallax(scrollY, viewportHeight) {
    const { drift } = this.refs;
    if (!drift || this.#geometry.height === 0) return;

    const elementCenter = this.#geometry.top + this.#geometry.height / 2 - scrollY;
    const progress = clamp((elementCenter - viewportHeight / 2) / viewportHeight, -1, 1);
    const value = `0 ${(progress * this.#parallaxAmplitude).toFixed(2)}%`;

    if (value === this.#parallaxLast) return;
    this.#parallaxLast = value;
    drift.style.translate = value;
  }

  /** Refresh cached geometry for the parallax loop (one deliberate layout
   *  read, outside the rAF hot path). */
  measure() {
    const rect = this.getBoundingClientRect();
    this.#geometry = { top: rect.top + window.scrollY, height: rect.height };
  }

  #hasEffect(token) {
    return (this.dataset.rEffect ?? '').split(/\s+/).includes(token);
  }

  #removeEffects(...tokens) {
    if (!this.dataset.rEffect) return;
    const remaining = this.dataset.rEffect.split(/\s+/).filter((token) => token && !tokens.includes(token));
    if (remaining.length > 0) {
      this.dataset.rEffect = remaining.join(' ');
    } else {
      delete this.dataset.rEffect;
    }
  }

  /** Arm CSS-side effects. `data-r-armed` is the JS-is-driving signal — the
   *  entrance/blur-up hidden states only apply under it, so a no-JS visitor
   *  (or a reduced-motion user) always sees the media. */
  #arm() {
    const armed = Boolean(this.dataset.rEffect) && !prefersReducedMotion();
    this.toggleAttribute('data-r-armed', armed);

    // The control is relevant for any video and for armed ken-burns stills
    // (auto-playing motion > 5s needs a pause control — WCAG 2.2.2). Under
    // reduced motion ken-burns never runs, so its control stays hidden.
    const needsToggle = Boolean(this.refs.video) || (armed && this.#hasEffect('ken-burns'));
    if (needsToggle) this.refs.toggle?.removeAttribute('hidden');
  }

  #initVideo() {
    const { video } = this.refs;
    if (!video || !this.#listeners) return;

    if (!this.dataset.rState) this.#setState('idle');

    // The automatic ladder's terminal "no video bytes" state. Re-derived on
    // every init because a morph resets the attribute to the server's "idle".
    if (!this.#shouldAutoplay() && !this.#userActivated && this.dataset.rState === 'idle') {
      this.#setState('static');
    }

    if (video === this.#wiredVideo) return;
    this.#wiredVideo = video;

    video.addEventListener(
      'ended',
      () => {
        playing.delete(this);
        this.#setState('ended');
      },
      { signal: this.#listeners.signal }
    );
  }

  #initBlurUp() {
    const { poster } = this.refs;
    if (!poster || !this.#hasEffect('blur-up') || !this.#listeners) return;

    if (poster.complete) {
      this.setAttribute('data-r-loaded', '');
      return;
    }

    if (poster === this.#wiredPoster) return;
    this.#wiredPoster = poster;

    const reveal = () => this.setAttribute('data-r-loaded', '');
    poster.addEventListener('load', reveal, { once: true, signal: this.#listeners.signal });
    // Fail open — never hold the layer invisible behind a broken image.
    poster.addEventListener('error', reveal, { once: true, signal: this.#listeners.signal });
  }

  #showEntrance() {
    if (!this.hasAttribute('data-r-armed') || this.hasAttribute('data-r-visible')) return;
    // Let layout settle before flipping the transition class (jumbo-text pattern).
    yieldToMainThread().then(() => {
      if (this.#inView) this.setAttribute('data-r-visible', '');
    });
  }

  /** Automatic-playback eligibility. User activation is handled separately. */
  #shouldAutoplay() {
    if (!this.hasAttribute('data-r-autoplay')) return false;
    if (prefersReducedMotion()) return false;
    if (navigator.connection?.saveData) return false;
    if (matchMedia('(prefers-reduced-data: reduce)').matches) return false;
    return true;
  }

  #syncPlayback() {
    const { video } = this.refs;
    if (!video || document.hidden) return;

    const wantsPlay = (this.#shouldAutoplay() || this.#userActivated) && !this.#userPaused;

    if (this.#playEligible && wantsPlay && this.dataset.rState !== 'ended') {
      this.#tryPlay();
    } else if (!this.#inView && this.dataset.rState === 'playing') {
      this.#pause();
    }
  }

  async #tryPlay() {
    const { video } = this.refs;
    if (!video || this.#playPending) return;
    if (this.dataset.rState === 'playing' && !video.paused) return;

    this.prepare();
    this.#playPending = true;

    try {
      await video.play();
      this.#setState('playing');
      this.#registerPlaying();

      // The element may have left the viewport while play() settled.
      if (!this.#inView && !this.#userActivated) this.#pause();
    } catch {
      // Autoplay rejected (iOS Low Power Mode, browser policy). The poster
      // stays and the control invites a manual play — that user gesture is
      // exactly what the policy wants.
      this.#setState('blocked');
    } finally {
      this.#playPending = false;
    }
  }

  #registerPlaying() {
    playing.delete(this);
    playing.add(this);

    // FIFO-pause the oldest beyond the cap.
    while (playing.size > MAX_PLAYING) {
      const [oldest] = playing;
      if (!oldest || oldest === this) break;
      oldest.systemPause();
    }
  }

  #pause() {
    const { video } = this.refs;
    if (!video) return;

    video.pause();
    playing.delete(this);
    if (this.dataset.rState === 'playing') this.#setState('paused');
  }

  #syncParallax() {
    const active =
      this.#hasEffect('parallax') && this.#inView && this.hasAttribute('data-r-armed') && !prefersReducedMotion();

    if (!active) {
      parallaxActive.delete(this);
      return;
    }

    if (!parallaxActive.has(this)) {
      this.measure();
      const range = parseFloat(getComputedStyle(this).getPropertyValue('--r-media-parallax-range'));
      this.#parallaxAmplitude = (Number.isNaN(range) ? 6 : range) / 2;
      parallaxActive.add(this);
    }

    startParallaxLoop();
  }

  /** @param {string} state */
  #setState(state) {
    this.dataset.rState = state;
  }
}

if (!customElements.get('r-media')) {
  customElements.define('r-media', RMedia);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const media of [...playing]) media.systemPause();
    } else {
      for (const media of instances) media.resync();
      startParallaxLoop();
    }
  });

  // bfcache restore: browsers pause media entering the cache — re-evaluate.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    for (const media of instances) media.resync();
  });

  // Parallax geometry is cached; refresh it when layout actually changes.
  let resizeTimer = 0;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const media of parallaxActive) media.measure();
      }, 150);
    },
    { passive: true }
  );

  // Honour live preference flips (e.g. macOS Reduce Motion mid-session).
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    for (const media of instances) {
      if (media instanceof RMedia) {
        media.systemPause();
        media.resync();
      }
    }
  });
}
