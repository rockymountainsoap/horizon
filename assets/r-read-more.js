import { Component } from '@theme/component';

/**
 * <r-read-more> — mobile "Show more / Show less" for clamped prose.
 *
 * Visibility of the toggle is CSS-driven (shown on mobile, hidden on desktop —
 * see r-pdp-description's stylesheet), so it works even if this script never
 * runs. This element:
 *   - flips `data-expanded` on click and keeps `aria-expanded` in sync;
 *   - sets `data-fits` when the collapsed copy is short enough not to need a
 *     toggle, so the toggle can hide itself for short descriptions.
 *
 * @typedef {Object} Refs
 * @property {HTMLElement} button - the show more/less toggle
 * @property {HTMLElement} content - the clamped content wrapper
 * @extends {Component<Refs>}
 */
class RReadMore extends Component {
  requiredRefs = ['button', 'content'];

  /** @type {(() => void) | undefined} */
  #onResize;

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(this.#measure);
    this.#onResize = this.#debounce(this.#measure, 150);
    window.addEventListener('resize', this.#onResize, { passive: true });
  }

  disconnectedCallback() {
    if (this.#onResize) window.removeEventListener('resize', this.#onResize);
    super.disconnectedCallback();
  }

  /**
   * Toggle expanded state.
   * @param {Event} [event]
   */
  toggle = (event) => {
    event?.preventDefault();
    const expanded = this.dataset.expanded === 'true';
    this.dataset.expanded = expanded ? 'false' : 'true';
    this.refs.button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  };

  /** Flag `data-fits` when the collapsed content does not overflow its clamp. */
  #measure = () => {
    // While expanded the content is unclamped; keep the toggle available so the
    // reader can collapse again.
    if (this.dataset.expanded === 'true') {
      this.removeAttribute('data-fits');
      return;
    }
    const { content } = this.refs;
    const fits = content.scrollHeight - content.clientHeight <= 4;
    this.toggleAttribute('data-fits', fits);
  };

  /**
   * @param {() => void} fn
   * @param {number} ms
   * @returns {() => void}
   */
  #debounce(fn, ms) {
    /** @type {ReturnType<typeof setTimeout>} */
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }
}

if (!customElements.get('r-read-more')) {
  customElements.define('r-read-more', RReadMore);
}
