/**
 * Rocky — Sticky Sidebar
 * Custom element: `<r-sticky-sidebar>`
 *
 * Keeps the product-details column visible while the (taller) media gallery
 * scrolls past, using the browser's native `position: sticky` — with the full
 * "smart sidebar" behaviour (à la abouolia/sticky-sidebar) for columns taller
 * than the viewport:
 *
 *   • scrolling DOWN the column travels with the page until its BOTTOM edge
 *     meets the viewport bottom, then pins there (all of its content has been
 *     readable on the way);
 *   • scrolling UP it immediately travels with the page again until its TOP
 *     edge meets the viewport top (below any pinned header), then pins there;
 *   • it never leaves its container — native sticky guarantees the bounds.
 *
 * ── Why native `position: sticky`, and nothing else ─────────────────────────
 * Pinning the column with `transform: translateY()` (as the original library
 * does) jitters on real hardware: the details column is a deep, text-heavy
 * subtree, and translating it by sub-pixel amounts every scroll frame forces
 * the compositor to re-sample its layer. `position: sticky` pins the element
 * in lock-step with scroll on the compositor, with no transform on content.
 *
 * The dual-direction travel is achieved by sliding the sticky `top` between
 * two bounds by the scroll delta:
 *
 *   top ∈ [ viewport − columnHeight − bottomSpacing , headerOffset ]
 *         └ bottom edge pinned to viewport bottom     └ top edge pinned
 *
 * While `top` sits at either bound (the overwhelming majority of scroll time)
 * no style is written at all; writes only happen during the brief traveling
 * phase after a direction change — one inline `top` per scroll event, which
 * the compositor applies without reflowing the column's content.
 *
 * ── Two cases ───────────────────────────────────────────────────────────────
 *   • Column FITS the viewport — pinned with a positive `top`. Handled purely
 *     by CSS (`top: var(--r-sticky-header-offset, 0px)`); the scroll handler
 *     exits on a single boolean and never writes.
 *   • Column is TALLER than the viewport — the delta-clamp travel above.
 *
 * ── Attributes (all optional) ───────────────────────────────────────────────
 *   top-spacing     Extra px gap below the header for a top-pinned column (default 0).
 *   bottom-spacing  Extra px gap below a bottom-pinned column (default 0).
 *   min-width       Viewport width below which sticky is disabled (default 750).
 */

const TAG_NAME = 'r-sticky-sidebar';
const DEFAULT_MIN_WIDTH = 750;

class RStickySidebar extends HTMLElement {
  /** Extra px gap kept above a top-pinned column. @type {number} */
  _topSpacing = 0;

  /** Extra px gap kept below a bottom-pinned column. @type {number} */
  _bottomSpacing = 0;

  /** Viewport width (px) below which sticky is disabled. @type {number} */
  _minWidth = DEFAULT_MIN_WIDTH;

  /** True while the column is taller than the viewport (travel mode). @type {boolean} */
  _tall = false;

  /** Current numeric `top` while in travel mode. @type {number} */
  _top = 0;

  /** Travel bounds while in travel mode. @type {number} */
  _minTop = 0;
  /** @type {number} */
  _maxTop = 0;

  /** Last seen scroll position, for direction deltas. @type {number} */
  _lastScrollY = 0;

  /** requestAnimationFrame id for the deferred first measure. @type {number} */
  _bootId = 0;

  /** requestAnimationFrame id for a coalesced re-measure. @type {number} */
  _rafId = 0;

  /** The inline `top` value last written, to spot external (morph) resets. @type {string} */
  _lastTop = '';

  /** True once listeners/observers are wired up. @type {boolean} */
  _setupDone = false;

  /** Bound `resize` handler. @type {(() => void) | null} */
  _onResize = null;

  /** Bound `scroll` handler. @type {(() => void) | null} */
  _onScroll = null;

  /** @type {ResizeObserver | null} */
  _resizeObs = null;

  /** @type {MutationObserver | null} */
  _mutationObs = null;

  connectedCallback() {
    if (this._setupDone) return;

    this._topSpacing = parseFloat(this.getAttribute('top-spacing') ?? '') || 0;
    this._bottomSpacing = parseFloat(this.getAttribute('bottom-spacing') ?? '') || 0;
    this._minWidth =
      parseFloat(this.getAttribute('min-width') ?? '') || DEFAULT_MIN_WIDTH;

    // Layout is not guaranteed settled on the first connected tick (fonts,
    // images). Defer one frame; observers keep it honest afterwards.
    this._bootId = requestAnimationFrame(() => this._setup());
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._bootId);
    cancelAnimationFrame(this._rafId);
    this._rafId = 0;
    if (!this._setupDone) return;

    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._onScroll) window.removeEventListener('scroll', this._onScroll);
    this._resizeObs?.disconnect();
    this._mutationObs?.disconnect();
    this.style.top = '';
    this._lastTop = '';
    this._setupDone = false;
  }

  /** Public: force a re-measure (e.g. after dynamic content changes). */
  update() {
    if (this._setupDone) this._schedule();
  }

  _setup() {
    const onResize = () => this._schedule();
    this._onResize = onResize;
    window.addEventListener('resize', onResize, { passive: true });

    const onScroll = () => this._travel();
    this._onScroll = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    this._lastScrollY = window.scrollY;

    // The short/tall decision only changes with the column's own height
    // (accordions, variant swaps, fonts) or the viewport height.
    if ('ResizeObserver' in window) {
      this._resizeObs = new ResizeObserver(() => this._schedule());
      this._resizeObs.observe(this);
    }

    // A section morph (e.g. variant change) can reset our inline `top`.
    // Re-apply if it was stripped — without reacting to our own writes.
    if ('MutationObserver' in window) {
      this._mutationObs = new MutationObserver(() => {
        if (this.style.top !== this._lastTop) this._schedule();
      });
      this._mutationObs.observe(this, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    // Web fonts can change the column height after first paint.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => this._schedule()).catch(() => {});
    }

    this._setupDone = true;
    this._reposition();
  }

  /** Coalesce re-measures into a single rAF. */
  _schedule() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0;
      this._reposition();
    });
  }

  /**
   * Per-scroll travel for the taller-than-viewport case: slide `top` between
   * the bottom-pin and top-pin bounds by the scroll delta. While the column is
   * parked at either bound this is a compare-and-return — no writes.
   */
  _travel() {
    const y = window.scrollY;
    const dy = y - this._lastScrollY;
    this._lastScrollY = y;

    if (!this._tall || dy === 0) return;

    const top = Math.min(this._maxTop, Math.max(this._minTop, this._top - dy));
    if (top !== this._top) {
      this._top = top;
      this._writeTop(`${top}px`);
    }
  }

  /**
   * Decides fits vs travel mode and the travel bounds. Runs on setup / resize /
   * column-height change — `position: sticky` itself does the per-frame work.
   */
  _reposition() {
    if (!this.isConnected) return;

    // Below the breakpoint the CSS rule that enables sticky is not in effect;
    // make sure no stale offset lingers.
    if (window.innerWidth <= this._minWidth) {
      this._tall = false;
      this._writeTop('');
      return;
    }

    const columnHeight = this.offsetHeight;
    const viewportHeight = window.innerHeight;
    const headerOffset =
      parseFloat(getComputedStyle(this).getPropertyValue('--r-sticky-header-offset')) || 0;

    const maxTop = headerOffset + this._topSpacing;
    const minTop = viewportHeight - columnHeight - this._bottomSpacing;

    if (columnHeight > 0 && minTop < maxTop) {
      // Taller than the viewport → travel mode. Preserve visual continuity by
      // seeding from where the column currently sits, clamped into the new
      // bounds (matters when heights change while pinned, e.g. the subscribe
      // panel expanding).
      const wasTall = this._tall;
      this._tall = true;
      this._minTop = minTop;
      this._maxTop = maxTop;

      const seed = wasTall ? this._top : this.getBoundingClientRect().top;
      this._top = Math.min(maxTop, Math.max(minTop, seed));
      this._writeTop(`${this._top}px`);
    } else {
      // Fits the viewport → hand back to the CSS rule's positive `top`.
      this._tall = false;
      this._writeTop('');
    }
  }

  /**
   * Sets the inline `top`, remembering it so the MutationObserver can tell our
   * own write apart from an external (morph) reset.
   * @param {string} value
   */
  _writeTop(value) {
    if (this.style.top !== value) this.style.top = value;
    this._lastTop = value;
  }
}

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, RStickySidebar);
}
