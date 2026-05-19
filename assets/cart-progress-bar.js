import { Component } from '@theme/component';

/**
 * Server-rendered progress bar with two post-morph effects:
 *
 *   1. Shimmer — when the subtotal grows but no tier crossed, briefly
 *      animate the fill colour to draw the eye.
 *
 *   2. Celebrate — when a new tier flips from locked → unlocked between
 *      morph passes, set `data-celebrate="1" | "2"` for ~900ms so CSS
 *      can play a marker-pulse and chip-pop on the just-unlocked tier.
 *
 * All math (fill width, milestone position, message copy) is owned by
 * Liquid — this component reacts to dataset deltas only.
 */
class RCartProgressBar extends Component {
  /** @type {number | undefined} */
  #previousSubtotal;
  /** @type {boolean} */
  #previousTier1Unlocked = false;
  /** @type {boolean} */
  #previousTier2Unlocked = false;
  /** @type {number | undefined} */
  #shimmerTimer;
  /** @type {number | undefined} */
  #celebrateTimer;

  connectedCallback() {
    super.connectedCallback();
    this.#previousSubtotal = this.#readSubtotal();
    this.#previousTier1Unlocked = this.#readBool('tier1Unlocked');
    this.#previousTier2Unlocked = this.#readBool('tier2Unlocked');
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
    if (this.#shimmerTimer != null) {
      window.clearTimeout(this.#shimmerTimer);
      this.#shimmerTimer = undefined;
    }
    if (this.#celebrateTimer != null) {
      window.clearTimeout(this.#celebrateTimer);
      this.#celebrateTimer = undefined;
    }
  }

  updatedCallback() {
    super.updatedCallback?.();

    const subtotal = this.#readSubtotal();
    const tier1Unlocked = this.#readBool('tier1Unlocked');
    const tier2Unlocked = this.#readBool('tier2Unlocked');

    const tier1JustCrossed = !this.#previousTier1Unlocked && tier1Unlocked;
    const tier2JustCrossed = !this.#previousTier2Unlocked && tier2Unlocked;

    if (tier2JustCrossed) {
      this.#celebrate('2');
    } else if (tier1JustCrossed) {
      this.#celebrate('1');
    } else if (
      typeof this.#previousSubtotal === 'number' &&
      typeof subtotal === 'number' &&
      subtotal > this.#previousSubtotal
    ) {
      this.#shimmer();
    }

    this.#previousSubtotal = subtotal;
    this.#previousTier1Unlocked = tier1Unlocked;
    this.#previousTier2Unlocked = tier2Unlocked;
  }

  /** @param {'1' | '2'} tier */
  #celebrate(tier) {
    if (this.#celebrateTimer != null) {
      window.clearTimeout(this.#celebrateTimer);
    }
    this.dataset.celebrate = tier;
    this.#celebrateTimer = window.setTimeout(() => {
      delete this.dataset.celebrate;
      this.#celebrateTimer = undefined;
    }, 950);
  }

  #shimmer() {
    if (this.#shimmerTimer != null) {
      window.clearTimeout(this.#shimmerTimer);
    }
    this.classList.add('r-cart-progress--shimmer');
    this.#shimmerTimer = window.setTimeout(() => {
      this.classList.remove('r-cart-progress--shimmer');
      this.#shimmerTimer = undefined;
    }, 900);
  }

  #readSubtotal() {
    const raw = this.dataset.subtotal;
    if (raw == null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  /** @param {'tier1Unlocked' | 'tier2Unlocked'} key */
  #readBool(key) {
    return this.dataset[key] === 'true';
  }
}

if (!customElements.get('r-cart-progress-bar')) {
  customElements.define('r-cart-progress-bar', RCartProgressBar);
}
