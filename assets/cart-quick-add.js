import { Component } from '@theme/component';
import { fetchConfig } from '@theme/utilities';
import { CartAddEvent } from '@theme/events';

/**
 * Wraps a single `<button>` and translates clicks into a
 * `POST /cart/add.js` request with sections, then dispatches a
 * `CartAddEvent` so all cart surfaces (icon, drawer, progress bar,
 * free-gift orchestrator) update in lockstep.
 *
 * Markup:
 *   <r-cart-quick-add data-variant-id="123">
 *     <button>Add</button>
 *   </r-cart-quick-add>
 */
class RCartQuickAdd extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (!button) return;
    if (this.dataset.busy === 'true') return;

    const variantId = this.dataset.variantId;
    if (!variantId) return;

    event.preventDefault();
    this.#add(button, variantId);
  };

  /**
   * @param {HTMLButtonElement} button
   * @param {string} variantId
   */
  async #add(button, variantId) {
    this.dataset.busy = 'true';
    button.disabled = true;
    const previousText = button.textContent;
    button.dataset.previousText = previousText ?? '';

    /** @type {Set<string>} */
    const sectionsToUpdate = new Set();
    for (const el of document.querySelectorAll('cart-items-component')) {
      if (el instanceof HTMLElement && el.dataset.sectionId) sectionsToUpdate.add(el.dataset.sectionId);
    }

    const body = JSON.stringify({
      id: variantId,
      quantity: 1,
      sections: Array.from(sectionsToUpdate).join(','),
      sections_url: window.location.pathname,
    });

    try {
      const response = await fetch(`${Theme.routes.cart_add_url}`, fetchConfig('json', { body }));
      const text = await response.text();
      const data = JSON.parse(text);

      if (!response.ok || data.status) {
        console.error('[cart-quick-add] add failed', data);
        return;
      }

      // Fetch the full cart so listeners that read `event.detail.resource`
      // (e.g. free-gift orchestrator) see the latest items array.
      const cartResponse = await fetch(`${Theme.routes.cart_url}.js`, { headers: { Accept: 'application/json' } });
      const cart = cartResponse.ok ? await cartResponse.json() : data;

      const [sourceSectionId] = sectionsToUpdate;
      document.dispatchEvent(
        new CartAddEvent(cart, sourceSectionId ?? this.id ?? 'cart-quick-add', {
          source: 'cart-quick-add',
          itemCount: cart.item_count,
          variantId,
          sections: data.sections,
        })
      );
    } catch (error) {
      console.error('[cart-quick-add]', error);
    } finally {
      this.dataset.busy = 'false';
      button.disabled = false;
    }
  }
}

if (!customElements.get('r-cart-quick-add')) {
  customElements.define('r-cart-quick-add', RCartQuickAdd);
}
