/**
 * Rocky — Sticky Sidebar
 * Custom element: `<r-sticky-sidebar>`
 *
 * Keeps the product-details column visible while the (taller) media gallery
 * scrolls past, using the browser's native `position: sticky`.
 *
 * ── Why native `position: sticky`, and nothing else ─────────────────────────
 * Pinning the column with `transform: translateY()` jitters on real hardware:
 * the details column is a deep, text-heavy subtree, and translating it by a
 * sub-pixel amount every scroll frame forces the compositor to re-sample its
 * layer — a faint but persistent shimmer.
 *
 * `position: sticky` pins the element by adjusting its box on the compositor
 * thread, in lock-step with scroll, with NO transform on the content and no
 * main-thread work. It is the browser's purpose-built mechanism for this, and
 * it is glass smooth. So this element is a thin helper around it.
 *
 * The sticky is applied to the column element itself (`<r-sticky-sidebar>`),
 * whose containing block is the product grid — and the grid is as tall as the
 * media gallery, so the column has the gallery's full height to travel within.
 * The inner `.group-block` is never touched: no transform, no will-change.
 *
 * ── Two cases ───────────────────────────────────────────────────────────────
 *   • Column FITS the viewport — pinned with a positive `top`. Handled purely
 *     by CSS (`top: var(--r-sticky-header-offset, 0px)`); the engine does
 *     nothing, so there is zero JavaScript involved while scrolling.
 *   • Column is TALLER than the viewport — a positive `top` would strand its
 *     lower content off-screen. The engine instead sets a NEGATIVE inline
 *     `top` (`viewportHeight − columnHeight − bottomSpacing`), so the column's
 *     BOTTOM pins to the viewport bottom: scrolling down follows the column
 *     until its end is reached; scrolling up releases it. Recomputed only on
 *     resize / column-height change — never per scroll frame.
 *
 * ── Attributes (all optional) ───────────────────────────────────────────────
 *   bottom-spacing  Extra px gap below a bottom-pinned column (default 0).
 *   min-width       Viewport width below which sticky is disabled (default 750).
 */

const TAG_NAME = 'r-sticky-sidebar';
const DEFAULT_MIN_WIDTH = 750;

class RStickySidebar extends HTMLElement {
  /** Extra px gap kept below a bottom-pinned column. @type {number} */
  _bottomSpacing = 0;

  /** Viewport width (px) below which sticky is disabled. @type {number} */
  _minWidth = DEFAULT_MIN_WIDTH;

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

  /** @type {ResizeObserver | null} */
  _resizeObs = null;

  /** @type {MutationObserver | null} */
  _mutationObs = null;

  connectedCallback() {
    if (this._setupDone) return;

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
   * Decides the `top` offset. Runs only on setup / resize / height change —
   * never per scroll frame. `position: sticky` itself runs every scroll frame,
   * on the compositor.
   */
  _reposition() {
    if (!this.isConnected) return;

    // Below the breakpoint the CSS rule that enables sticky is not in effect;
    // make sure no stale negative offset lingers.
    if (window.innerWidth <= this._minWidth) {
      this._writeTop('');
      return;
    }

    const columnHeight = this.offsetHeight;
    const viewportHeight = window.innerHeight;

    if (columnHeight > 0 && columnHeight + this._bottomSpacing > viewportHeight) {
      // Taller than the viewport → pin the BOTTOM with a negative offset so
      // the lower content (buy buttons, accordion) stays reachable.
      this._writeTop(`${viewportHeight - columnHeight - this._bottomSpacing}px`);
    } else {
      // Fits the viewport → hand back to the CSS rule's positive `top`.
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
