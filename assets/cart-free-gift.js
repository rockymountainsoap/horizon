import { ThemeEvents, CartUpdateEvent } from '@theme/events';
import { fetchConfig } from '@theme/utilities';

/**
 * Auto-add / auto-remove the configured Tier 2 free gift line item
 * whenever the cart `items_subtotal_price` crosses the threshold.
 *
 * Reads merchant config from `data-r-*` attributes on
 * `<cart-drawer-component>` (see snippets/header-actions.liquid).
 *
 * Re-runs on every `cart:update` so a manual tamper that removes the
 * gift while above-threshold is self-corrected. Self-dispatched updates
 * carry `detail.data.source === 'cart-free-gift'` and short-circuit.
 *
 * On script load also performs an initial check against the live cart
 * — so an existing above-threshold cart triggers the gift add without
 * waiting for another cart event.
 *
 * Debug surface: a `data-r-gift-debug` attribute is set on the
 * `<cart-drawer-component>` after each handler tick describing what
 * happened. Inspect that in DevTools to diagnose stuck states.
 */

const SOURCE = 'cart-free-gift';
const FREE_GIFT_PROPERTY = '_free_gift';

/** @type {Promise<unknown> | null} */
let pending = null;

function readConfig() {
  const root = document.querySelector('cart-drawer-component');
  if (!(root instanceof HTMLElement)) return null;
  const variantId = root.dataset.rGiftVariantId;
  const tier2Cents = Number(root.dataset.rTier2Cents);
  if (!variantId || !Number.isFinite(tier2Cents) || tier2Cents <= 0) return null;
  return { variantId, tier2Cents, root };
}

function setDebug(message) {
  const root = document.querySelector('cart-drawer-component');
  if (root instanceof HTMLElement) {
    root.dataset.rGiftDebug = `${new Date().toISOString().slice(11, 19)} ${message}`;
  }
}

/**
 * @param {{items?: Array<{variant_id: number, key: string, properties?: Record<string, unknown>}>}} cart
 * @param {string} variantId
 */
function findGiftLine(cart, variantId) {
  if (!cart?.items) return null;
  const target = String(variantId);
  return (
    cart.items.find((item) => {
      if (!item) return false;
      if (String(item.variant_id) !== target) return false;
      const props = /** @type {Record<string, unknown>} */ (item.properties ?? {});
      const marked = props[FREE_GIFT_PROPERTY];
      return marked === 'true' || marked === true;
    }) ?? null
  );
}

/** @param {string} variantId */
async function addGift(variantId) {
  setDebug(`adding gift variant=${variantId}`);
  /** @type {Set<string>} */
  const sectionsToUpdate = new Set();
  for (const el of document.querySelectorAll('cart-items-component')) {
    if (el instanceof HTMLElement && el.dataset.sectionId) sectionsToUpdate.add(el.dataset.sectionId);
  }

  const body = JSON.stringify({
    id: variantId,
    quantity: 1,
    properties: { [FREE_GIFT_PROPERTY]: 'true' },
    sections: Array.from(sectionsToUpdate).join(','),
    sections_url: window.location.pathname,
  });

  let response;
  let text = '';
  try {
    response = await fetch(`${Theme.routes.cart_add_url}`, fetchConfig('json', { body }));
    text = await response.text();
  } catch (error) {
    console.error('[cart-free-gift] network error on add', error);
    setDebug(`add network error: ${String(error)}`);
    return;
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('[cart-free-gift] non-JSON response on add', { status: response?.status, text });
    setDebug(`add non-json status=${response?.status}`);
    return;
  }

  if (!response.ok || data.status) {
    console.error('[cart-free-gift] add failed', data);
    setDebug(`add failed status=${response.status} body=${(data.description || data.message || '').slice(0, 80)}`);
    return;
  }

  let cart;
  try {
    const cartResponse = await fetch(`${Theme.routes.cart_url}.js`, {
      headers: { Accept: 'application/json' },
    });
    cart = cartResponse.ok ? await cartResponse.json() : data;
  } catch (error) {
    console.error('[cart-free-gift] cart refresh failed', error);
    cart = data;
  }

  const [sourceSectionId] = sectionsToUpdate;
  document.dispatchEvent(
    new CartUpdateEvent(cart, sourceSectionId ?? '', {
      itemCount: cart.item_count,
      source: SOURCE,
      sections: data.sections,
    })
  );
  setDebug(`added gift, new subtotal=${cart.items_subtotal_price}`);
}

/** @param {string} lineKey */
async function removeGift(lineKey) {
  setDebug(`removing gift key=${lineKey}`);
  /** @type {Set<string>} */
  const sectionsToUpdate = new Set();
  for (const el of document.querySelectorAll('cart-items-component')) {
    if (el instanceof HTMLElement && el.dataset.sectionId) sectionsToUpdate.add(el.dataset.sectionId);
  }

  const body = JSON.stringify({
    id: lineKey,
    quantity: 0,
    sections: Array.from(sectionsToUpdate).join(','),
    sections_url: window.location.pathname,
  });

  let response;
  let text = '';
  try {
    response = await fetch(`${Theme.routes.cart_change_url}`, fetchConfig('json', { body }));
    text = await response.text();
  } catch (error) {
    console.error('[cart-free-gift] network error on remove', error);
    setDebug(`remove network error: ${String(error)}`);
    return;
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    console.error('[cart-free-gift] non-JSON response on remove', { status: response?.status, text });
    setDebug(`remove non-json status=${response?.status}`);
    return;
  }

  if (data.errors) {
    console.error('[cart-free-gift] remove failed', data);
    setDebug(`remove failed: ${JSON.stringify(data.errors).slice(0, 80)}`);
    return;
  }

  const [sourceSectionId] = sectionsToUpdate;
  document.dispatchEvent(
    new CartUpdateEvent(data, sourceSectionId ?? '', {
      itemCount: data.item_count,
      source: SOURCE,
      sections: data.sections,
    })
  );
  setDebug(`removed gift`);
}

/**
 * @param {{resource?: any, data?: {source?: string}} | null} [detail]
 */
async function reconcile(detail) {
  if (detail?.data?.source === SOURCE) return;
  if (pending) return;

  const config = readConfig();
  if (!config) {
    setDebug('no config (gift product or threshold missing)');
    return;
  }

  // Resolve current cart. The event may carry it; fall back to /cart.js.
  let cart = detail?.resource;
  if (!cart || typeof cart.items_subtotal_price !== 'number') {
    try {
      const response = await fetch(`${Theme.routes.cart_url}.js`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        setDebug(`cart fetch ${response.status}`);
        return;
      }
      cart = await response.json();
    } catch (error) {
      console.error('[cart-free-gift] cart fetch failed', error);
      setDebug(`cart fetch error`);
      return;
    }
  }

  const subtotal = cart.items_subtotal_price;
  if (typeof subtotal !== 'number') {
    setDebug(`cart subtotal not numeric: ${typeof subtotal}`);
    return;
  }

  const giftLine = findGiftLine(cart, config.variantId);
  const shouldHaveGift = subtotal >= config.tier2Cents;

  setDebug(
    `subtotal=${subtotal} tier2=${config.tier2Cents} have=${!!giftLine} should=${shouldHaveGift}`
  );

  if (shouldHaveGift && !giftLine) {
    pending = addGift(config.variantId).finally(() => {
      pending = null;
    });
  } else if (!shouldHaveGift && giftLine) {
    pending = removeGift(giftLine.key).finally(() => {
      pending = null;
    });
  }
}

/** @param {Event} event */
function handleCartUpdate(event) {
  // Horizon's CartUpdateEvent extends Event (not CustomEvent) but attaches .detail manually.
  const detail = /** @type {any} */ (event).detail ?? null;
  void reconcile(detail);
}

document.addEventListener(ThemeEvents.cartUpdate, handleCartUpdate);

// Initial check on script load: if the page loads with a cart already
// above the threshold, add the gift without waiting for a future cart
// event. Run on idle so we don't compete with critical resources.
const initial = () => {
  setDebug('initial check');
  void reconcile(null);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initial, { once: true });
} else if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(initial, { timeout: 1500 });
} else {
  window.setTimeout(initial, 200);
}
