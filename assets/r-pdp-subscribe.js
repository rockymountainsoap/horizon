import { Component } from '@theme/component';

/**
 * <r-pdp-subscribe> — coordinator for the PDP One-time / Subscribe controls.
 *
 * The toggle (inside this element) and the reveal panel (a separate, full-width
 * element found by selector) are both server-rendered in their final positions
 * by buy-buttons.liquid, so there is no layout shift on load. This element only
 * hydrates behaviour once its module loads: it reflects the chosen purchase type
 * into a hidden `selling_plan` input on the product form (empty for one-time, the
 * selected frequency's plan for subscribe) and expands/collapses the panel.
 *
 * product-form-component serialises the whole form (new FormData), so the plan is
 * carried on add-to-cart when subscribing and absent otherwise.
 */
class RPdpSubscribe extends Component {
  /** @type {HTMLElement | null} */ #panel = null;
  /** @type {HTMLElement | null} */ #frequency = null;
  /** @type {HTMLInputElement | null} */ #input = null;

  connectedCallback() {
    super.connectedCallback();
    this.#panel = this.#findInSection('[data-r-panel]');
    this.#frequency = this.#panel?.querySelector('[data-r-frequency]') ?? null;

    // The toggle radios live inside this element, so their change bubbles here.
    this.addEventListener('change', this.#onChange);
    // Frequency radios live in the (separate) panel — listen on it directly.
    this.#frequency?.addEventListener('change', this.#onChange);

    // Reflect the initial (server-rendered) state without changing layout.
    this.#sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('change', this.#onChange);
    this.#frequency?.removeEventListener('change', this.#onChange);
  }

  /** @param {string} selector @returns {HTMLElement | null} */
  #findInSection(selector) {
    const sectionId = this.dataset.sectionId;
    const scope =
      (sectionId && document.querySelector(`product-form-component[data-section-id="${sectionId}"]`)) ||
      this.closest('.shopify-section') ||
      document;
    const found = scope.querySelector(selector);
    return found instanceof HTMLElement ? found : null;
  }

  /** @returns {HTMLFormElement | null} */
  get #form() {
    const sectionId = this.dataset.sectionId;
    const bySection =
      sectionId &&
      document.querySelector(`product-form-component[data-section-id="${sectionId}"] form`);
    if (bySection instanceof HTMLFormElement) return bySection;
    const scoped = this.closest('.shopify-section')?.querySelector('product-form-component form');
    return scoped instanceof HTMLFormElement ? scoped : null;
  }

  /** Ensure the owned hidden `selling_plan` input exists inside the product form. */
  #ensureInput() {
    const form = this.#form;
    if (!form) return null;
    if (this.#input && this.#input.isConnected && form.contains(this.#input)) return this.#input;

    let input = /** @type {HTMLInputElement | null} */ (
      form.querySelector('input[name="selling_plan"][data-r-pdp-subscribe]')
    );
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'selling_plan';
      input.setAttribute('data-r-pdp-subscribe', '');
      form.appendChild(input);
    }
    this.#input = input;
    return input;
  }

  /** @returns {boolean} */
  get #subscribed() {
    const checked = /** @type {HTMLInputElement | null} */ (
      this.querySelector('[data-r-toggle] input[type="radio"]:checked')
    );
    return checked?.value === 'subscribe';
  }

  /** @returns {string} The selling-plan id for the chosen frequency (or default). */
  #planId() {
    const freq = /** @type {HTMLInputElement | null} */ (
      this.#frequency?.querySelector('input[type="radio"]:checked')
    );
    return freq?.value || this.dataset.defaultPlan || '';
  }

  #sync() {
    const subscribed = this.#subscribed;
    const input = this.#ensureInput();
    if (input) input.value = subscribed ? this.#planId() : '';

    if (this.#panel) {
      this.#panel.dataset.expanded = subscribed ? 'true' : 'false';
      if (subscribed) this.#panel.removeAttribute('inert');
      else this.#panel.setAttribute('inert', '');
    }
    this.dataset.active = subscribed ? 'true' : 'false';
  }

  /** @param {Event} event */
  #onChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio') return;
    this.#sync();
  };
}

if (!customElements.get('r-pdp-subscribe')) {
  customElements.define('r-pdp-subscribe', RPdpSubscribe);
}
