import { Component } from '@theme/component';
import { fetchConfig } from '@theme/utilities';
import { CartUpdateEvent } from '@theme/events';

/**
 * @param {object} args
 * @param {string} args.lineKey
 * @param {string} args.sellingPlan
 * @param {HTMLElement} args.host
 * @returns {Promise<void>}
 */
function changeCartLine({ lineKey, sellingPlan, host }) {
  if (host.dataset.busy === 'true') return Promise.resolve();
  host.dataset.busy = 'true';

  const sectionsToUpdate = new Set();
  document.querySelectorAll('cart-items-component').forEach((el) => {
    if (el instanceof HTMLElement && el.dataset.sectionId) {
      sectionsToUpdate.add(el.dataset.sectionId);
    }
  });

  const body = JSON.stringify({
    id: lineKey,
    selling_plan: sellingPlan,
    sections: Array.from(sectionsToUpdate).join(','),
    sections_url: window.location.pathname,
  });

  return fetch(`${Theme.routes.cart_change_url}`, fetchConfig('json', { body }))
    .then((response) => response.text())
    .then((text) => {
      const data = JSON.parse(text);
      if (data.errors) {
        console.error('[r-cart-subscription] cart change failed', data);
        return;
      }
      const [sourceSectionId] = sectionsToUpdate;
      document.dispatchEvent(
        new CartUpdateEvent(data, sourceSectionId ?? '', {
          itemCount: data.item_count,
          source: 'r-cart-subscription',
          sections: data.sections,
        })
      );
    })
    .catch((error) => {
      console.error('[r-cart-subscription]', error);
    })
    .finally(() => {
      delete host.dataset.busy;
    });
}

class RCartLineSubscriptionToggle extends Component {
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
    if (!target.closest('[data-r-cart-subscribe-trigger]')) return;
    if (this.dataset.busy === 'true') return;

    event.preventDefault();

    const lineKey = this.dataset.lineKey;
    const planId = this.dataset.sellingPlanId;
    if (!lineKey || !planId) return;

    const isActive = this.dataset.active === 'true';
    const trigger = this.querySelector('[data-r-cart-subscribe-trigger]');
    if (trigger instanceof HTMLButtonElement) trigger.disabled = true;

    changeCartLine({ lineKey, sellingPlan: isActive ? '' : planId, host: this })
      .finally(() => {
        if (trigger instanceof HTMLButtonElement) trigger.disabled = false;
      });
  };
}

class RCartLineSubscriptionFrequency extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#onChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('change', this.#onChange);
  }

  /** @param {Event} event */
  #onChange = (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;

    const lineKey = this.dataset.lineKey;
    const planId = select.value;
    if (!lineKey || !planId || planId === this.dataset.currentPlanId) return;

    select.disabled = true;
    changeCartLine({ lineKey, sellingPlan: planId, host: this }).finally(() => {
      select.disabled = false;
    });
  };
}

if (!customElements.get('r-cart-line-subscription-toggle')) {
  customElements.define('r-cart-line-subscription-toggle', RCartLineSubscriptionToggle);
}
if (!customElements.get('r-cart-line-subscription-frequency')) {
  customElements.define('r-cart-line-subscription-frequency', RCartLineSubscriptionFrequency);
}
