import { Component } from '@theme/component';
import { ThemeEvents } from '@theme/events';
import { onAnimationEnd, prefersReducedMotion } from '@theme/utilities';

/**
 * `<r-cart-bumpers>` — the dual-mode cart bumpers container.
 *
 *   data-mode               'curated' | 'recommendations'
 *   data-batch-size         number — initial reveal count + Show More step
 *   data-anchor-queue       recs only — comma-separated cart product IDs,
 *                            most recently added first. JS pulls from the
 *                            front and fetches the next anchor when the
 *                            current one's recs are exhausted.
 *   data-recs-url           recs only — `routes.product_recommendations_url?limit=N`
 *   data-section-id         recs only — internal section id
 *   data-intent             recs only — `related` | `complementary`
 *
 * Curated mode: items are server-rendered into the list. The first
 * `batch_size` are visible; the rest carry `hidden` + `data-r-hidden`.
 *
 * Recommendations mode: server emits an empty `<ul>` plus the wrapper
 * data-attrs. JS fetches recs for the first anchor (with a complementary
 * → related fallback) and injects them all — first batch visible, rest
 * hidden. As the user clicks Show More past the current anchor's pool,
 * the JS fetches recs for the next cart product and appends them
 * (deduped by product ID). When a recs item is added to cart, it is
 * removed from the list.
 */

/** @type {Map<string, string>} */
const recommendationsCache = new Map();

class RCartBumpers extends Component {
  /** @type {AbortController | null} */
  #activeFetch = null;

  /** Cumulative visible-item count (preserved across morphs). */
  #revealedCount = 0;

  /** Remaining anchor product IDs to fetch (recs mode). @type {string[]} */
  #anchorQueue = [];

  /**
   * Product IDs to skip when injecting (recs mode). Seeded with every
   * product currently in the cart so we never recommend something the
   * customer already has, and grows as we render items so cross-anchor
   * results don't duplicate.
   * @type {Set<string>}
   */
  #seenProductIds = new Set();

  /** True while a recs fetch is in flight; gates Show More. */
  #fetching = false;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(ThemeEvents.cartUpdate, this.#onCartUpdate);
    this.#init();
  }

  updatedCallback() {
    super.updatedCallback?.();
    this.#init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(ThemeEvents.cartUpdate, this.#onCartUpdate);
    this.#activeFetch?.abort();
  }

  #init() {
    const mode = this.dataset.mode;
    const list = /** @type {HTMLElement | null} */ (this.querySelector('[data-r-bumpers-list]'));
    const more = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-r-bumpers-more]'));
    if (!list || !more) return;

    more.removeEventListener('click', this.#onMoreClick);
    more.addEventListener('click', this.#onMoreClick);

    if (mode === 'recommendations') {
      this.#initRecommendations(list, more);
    } else {
      this.#reveal();
      this.#initCurated(list, more);
    }
  }

  /**
   * Curated mode — items are server-rendered. Apply the persisted reveal
   * state (so Show More clicks survive cart morphs), then wire Show More.
   * @param {HTMLElement} list
   * @param {HTMLElement} more
   */
  #initCurated(list, more) {
    const items = /** @type {HTMLElement[]} */ (
      Array.from(list.querySelectorAll('[data-r-bumpers-item]'))
    );
    if (items.length === 0) return;

    const batch = Number(this.dataset.batchSize) || 3;
    const targetVisible = Math.max(batch, this.#revealedCount);

    items.forEach((item, idx) => {
      if (idx < targetVisible) {
        item.removeAttribute('data-r-hidden');
        item.removeAttribute('hidden');
      } else {
        item.setAttribute('data-r-hidden', 'true');
        item.setAttribute('hidden', '');
      }
    });

    this.#revealedCount = Math.min(targetVisible, items.length);
    this.#updateCount(this.#revealedCount, items.length);
    more.hidden = this.#revealedCount >= items.length;
  }

  /**
   * Recommendations mode — initialise anchor queue, fetch first anchor.
   * Idempotent across morphs: if items are already in the list and the
   * anchor queue hasn't materially changed, skip the work.
   * @param {HTMLElement} list
   * @param {HTMLElement} more
   */
  async #initRecommendations(list, more) {
    const queueAttr = this.dataset.anchorQueue || '';
    const incomingQueue = queueAttr.split(',').filter(Boolean);
    const hasItems = list.querySelector('[data-r-bumpers-item]') !== null;

    if (!hasItems) {
      // First mount, or a prior fetch returned nothing — initialise fresh.
      this.#anchorQueue = [...incomingQueue];
      this.#seenProductIds = new Set(incomingQueue);
      this.#revealedCount = 0;
      list.replaceChildren();
      this.dataset.rCurrentAnchor = incomingQueue[0] ?? '';
      await this.#fetchNextAnchorAndRender(list, more, /* initial */ true);
      return;
    }

    // Items already present — cart morph (add, qty change, line remove).
    // Preserve them. Wiping mid-animation would yank the just-added item out
    // before its slide-out completes, and refetching against the new anchor
    // can produce zero results, hiding the whole section. Just sync the
    // seen-set so newly added cart products aren't recommended later.
    for (const pid of incomingQueue) this.#seenProductIds.add(pid);
    this.#reveal();
    this.#reapplyVisibility(list, more);
  }

  /**
   * Fetch recs for the next anchor in the queue, append fresh items as
   * hidden, then reveal the next batch (initial reveal only on first
   * call). Returns true when items were appended.
   * @param {HTMLElement} list
   * @param {HTMLElement} more
   * @param {boolean} initial - true on the first fetch for this wrapper
   */
  async #fetchNextAnchorAndRender(list, more, initial = false) {
    if (this.#fetching) return false;
    this.#fetching = true;
    const skeleton = this.querySelector('[data-r-bumpers-skeleton]');
    if (skeleton instanceof HTMLElement && initial) skeleton.hidden = false;

    try {
      let appended = 0;
      while (this.#anchorQueue.length > 0 && appended === 0) {
        const anchorId = this.#anchorQueue.shift();
        if (!anchorId) continue;
        const fetched = await this.#fetchRecsFor(anchorId);
        for (const node of fetched) {
          const pid = node.dataset.productId;
          if (!pid || this.#seenProductIds.has(pid)) continue;
          this.#seenProductIds.add(pid);
          node.setAttribute('hidden', '');
          node.setAttribute('data-r-hidden', 'true');
          list.appendChild(node);
          appended++;
        }
      }

      if (skeleton instanceof HTMLElement) skeleton.hidden = true;

      const allItems = list.querySelectorAll('[data-r-bumpers-item]');
      if (allItems.length === 0) {
        // No items found across all anchors → hide entirely.
        this.#hide();
        return false;
      }

      this.#reveal();

      const batch = Number(this.dataset.batchSize) || 3;
      // On the initial fetch, reveal the first `batch` items. On
      // subsequent top-ups, reveal one batch worth from the freshly
      // appended items.
      const revealTarget = initial ? batch : this.#revealedCount + batch;
      this.#revealedCount = Math.min(revealTarget, allItems.length);
      this.#applyVisibility(list);
      this.#updateCount(this.#revealedCount, allItems.length);
      this.#updateMoreButton(more, list);
      return appended > 0;
    } finally {
      this.#fetching = false;
    }
  }

  /**
   * @param {string} anchorId
   * @returns {Promise<HTMLElement[]>}
   */
  async #fetchRecsFor(anchorId) {
    const recsUrl = this.dataset.recsUrl;
    const sectionId = this.dataset.sectionId;
    const primaryIntent = this.dataset.intent || 'related';
    if (!recsUrl || !sectionId) return [];

    const intents = primaryIntent === 'complementary' ? ['complementary', 'related'] : [primaryIntent];
    for (const intent of intents) {
      const url = `${recsUrl}&product_id=${anchorId}&section_id=${sectionId}&intent=${intent}`;
      let html = recommendationsCache.get(url);
      if (!html) {
        try {
          this.#activeFetch?.abort();
          this.#activeFetch = new AbortController();
          const response = await fetch(url, { signal: this.#activeFetch.signal });
          if (!response.ok) continue;
          html = await response.text();
          recommendationsCache.set(url, html);
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          console.error('[cart-bumpers] recs fetch failed', error);
          continue;
        } finally {
          this.#activeFetch = null;
        }
      }
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const items = /** @type {HTMLElement[]} */ (
        Array.from(parsed.querySelectorAll('[data-r-bumpers-item]'))
      );
      if (items.length > 0) return items;
    }
    return [];
  }

  /**
   * Re-apply visibility based on `#revealedCount` across the live items.
   * @param {HTMLElement} list
   */
  #applyVisibility(list) {
    const items = /** @type {HTMLElement[]} */ (
      Array.from(list.querySelectorAll('[data-r-bumpers-item]'))
    );
    items.forEach((item, idx) => {
      if (idx < this.#revealedCount) {
        item.removeAttribute('hidden');
        item.removeAttribute('data-r-hidden');
      } else {
        item.setAttribute('hidden', '');
        item.setAttribute('data-r-hidden', 'true');
      }
    });
  }

  /**
   * @param {HTMLElement} list
   * @param {HTMLElement} more
   */
  #reapplyVisibility(list, more) {
    const items = list.querySelectorAll('[data-r-bumpers-item]');
    if (this.#revealedCount === 0) {
      const batch = Number(this.dataset.batchSize) || 3;
      this.#revealedCount = Math.min(batch, items.length);
    }
    this.#applyVisibility(list);
    this.#updateCount(this.#revealedCount, items.length);
    this.#updateMoreButton(more, list);
  }

  /**
   * @param {HTMLElement} more
   * @param {HTMLElement} list
   */
  #updateMoreButton(more, list) {
    const allItems = list.querySelectorAll('[data-r-bumpers-item]');
    const moreHiddenItems = allItems.length - this.#revealedCount;
    const moreToFetch = this.#anchorQueue.length > 0;
    more.hidden = moreHiddenItems <= 0 && !moreToFetch;
  }

  /**
   * Re-query the DOM on every click. If no hidden items remain in
   * recommendations mode, fetch the next anchor's recs first.
   * @param {Event} event
   */
  #onMoreClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const list = /** @type {HTMLElement | null} */ (this.querySelector('[data-r-bumpers-list]'));
    const more = /** @type {HTMLElement | null} */ (this.querySelector('[data-r-bumpers-more]'));
    if (!list || !more) return;
    if (this.#fetching) return;

    let hiddenItems = list.querySelectorAll('[data-r-bumpers-item][hidden], [data-r-bumpers-item][data-r-hidden]');

    if (hiddenItems.length === 0 && this.dataset.mode === 'recommendations' && this.#anchorQueue.length > 0) {
      // Top up by fetching the next anchor; #fetchNextAnchorAndRender
      // also reveals the next batch and updates the UI.
      await this.#fetchNextAnchorAndRender(list, more, /* initial */ false);
      return;
    }

    if (hiddenItems.length === 0) {
      more.hidden = true;
      return;
    }

    const batch = Number(this.dataset.batchSize) || 3;
    this.#revealedCount += Math.min(batch, hiddenItems.length);
    this.#applyVisibility(list);
    const allItems = list.querySelectorAll('[data-r-bumpers-item]');
    this.#updateCount(this.#revealedCount, allItems.length);
    this.#updateMoreButton(more, list);
  };

  /**
   * Remove a bumper item from the list when the user adds it to cart.
   * Fired by `assets/cart-quick-add.js` via `CartAddEvent` (which uses
   * the `cart:update` event name). Triggers a graceful dismiss
   * animation, then unmounts the node on `animationend`.
   * @param {Event} event
   */
  #onCartUpdate = (event) => {
    const detail = /** @type {{ data?: { source?: string, variantId?: string | number } } | undefined} */ (
      /** @type {any} */ (event).detail
    );
    if (detail?.data?.source !== 'cart-quick-add') return;
    const variantId = detail.data.variantId;
    if (variantId == null) return;

    const list = /** @type {HTMLElement | null} */ (this.querySelector('[data-r-bumpers-list]'));
    const more = /** @type {HTMLElement | null} */ (this.querySelector('[data-r-bumpers-more]'));
    if (!list) return;

    const trigger = this.querySelector(`r-cart-quick-add[data-variant-id="${variantId}"]`);
    const item = /** @type {HTMLElement | null} */ (trigger?.closest('[data-r-bumpers-item]') ?? null);
    if (!item) return;

    const wasVisible = !item.hasAttribute('hidden');
    const finalize = () => this.#finalizeRemoval(item, list, more, wasVisible);

    if (!wasVisible || prefersReducedMotion()) {
      finalize();
      return;
    }

    // Match the cart-items__table-row removal pattern: pin the current
    // height into a CSS variable, add `removing`, then unmount once the
    // animation finishes.
    item.style.setProperty('--bumper-row-height', `${item.clientHeight}px`);
    item.classList.add('removing');
    onAnimationEnd(item, finalize);
  };

  /**
   * @param {HTMLElement} item
   * @param {HTMLElement} list
   * @param {HTMLElement | null} more
   * @param {boolean} wasVisible
   */
  #finalizeRemoval(item, list, more, wasVisible) {
    if (!item.isConnected) return;
    item.remove();
    if (wasVisible) {
      this.#revealedCount = Math.max(0, this.#revealedCount - 1);
    }

    const allItems = list.querySelectorAll('[data-r-bumpers-item]');
    const batch = Number(this.dataset.batchSize) || 3;
    // If removing the item drops us below the natural batch, reveal one more.
    if (allItems.length > this.#revealedCount && this.#revealedCount < batch) {
      this.#revealedCount = Math.min(batch, allItems.length);
      this.#applyVisibility(list);
    }
    this.#updateCount(this.#revealedCount, allItems.length);
    if (more instanceof HTMLElement) this.#updateMoreButton(more, list);

    // Recs mode: if list now empty, attempt to top up from the next anchor.
    if (
      this.dataset.mode === 'recommendations' &&
      allItems.length === 0 &&
      this.#anchorQueue.length > 0 &&
      more instanceof HTMLElement
    ) {
      this.#fetchNextAnchorAndRender(list, more, /* initial */ true);
    }
  }

  /**
   * @param {number} shown
   * @param {number} total
   */
  #updateCount(shown, total) {
    const el = this.querySelector('[data-r-bumpers-count]');
    if (!(el instanceof HTMLElement)) return;
    if (total <= shown) {
      el.textContent = '';
      return;
    }
    el.textContent = `${shown} of ${total}`;
  }

  #hide() {
    this.hidden = true;
  }

  #reveal() {
    this.hidden = false;
  }
}

if (!customElements.get('r-cart-bumpers')) {
  customElements.define('r-cart-bumpers', RCartBumpers);
}
