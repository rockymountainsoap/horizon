/**
 * r-wishlist-header — Rocky header wishlist icon + mini-drawer.
 *
 * For logged-in customers: fetches GIDs via App Proxy /list, then fetches
 * product details (with variants) via /products. Handles remove and add-to-cart inline.
 *
 * For guests: reads localStorage key `rmsc_wishlist_guest`.
 *
 * Listens for `wishlist:changed` and `wishlist:synced` events from
 * wishlist-button.js so the badge and list stay in sync.
 */

const GUEST_KEY = 'rmsc_wishlist_guest';

/**
 * Format a Money amount as a localised currency string.
 * @param {string|number} amount
 * @param {string} currencyCode
 */
function formatCurrency(amount, currencyCode) {
  try {
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: currencyCode,
    }).format(Number(amount));
  } catch {
    return `${currencyCode} ${Number(amount).toFixed(2)}`;
  }
}

/**
 * Flatten a GraphQL variant connection (edges/nodes) into a plain array.
 * @param {object} variants
 */
function flattenVariants(variants) {
  if (!variants) return [];
  if (Array.isArray(variants.nodes)) return variants.nodes;
  return (variants.edges ?? []).map((e) => e.node);
}

class RWishlistHeader extends HTMLElement {
  connectedCallback() {
    this._isLoggedIn = this.dataset.loggedIn === 'true';
    this._proxyBase = this.dataset.proxyBase || '/apps/wishlist';

    this._btn = /** @type {HTMLButtonElement} */ (this.querySelector('.r-wishlist-header__btn'));
    this._badge = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-header__badge'));
    this._dialog = /** @type {HTMLDialogElement} */ (this.querySelector('.r-wishlist-dialog'));
    this._dialogHeading = /** @type {HTMLElement} */ (this.querySelector('#r-wishlist-dialog-heading'));
    this._countLabel = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-dialog__count-label'));
    this._listEl = /** @type {HTMLUListElement} */ (this.querySelector('.r-wishlist-dialog__list'));
    this._emptyEl = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-dialog__empty'));
    this._guestNoteEl = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-dialog__guest-note'));
    this._loadingEl = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-dialog__loading'));
    this._contentEl = /** @type {HTMLElement} */ (this.querySelector('.r-wishlist-dialog__content'));
    this._viewAllEl = /** @type {HTMLAnchorElement} */ (this.querySelector('.r-wishlist-dialog__view-all'));
    this._closeBtn = /** @type {HTMLButtonElement} */ (this.querySelector('.r-wishlist-dialog__close'));

    this._list = [];
    this._products = [];
    this._loading = false;
    /** @type {number} */
    this._previousScrollY = 0;

    this._btn?.addEventListener('click', () => this._toggle());
    this._closeBtn?.addEventListener('click', () => this._close());

    // Close on backdrop click
    this._dialog?.addEventListener('click', (e) => {
      if (e.target === this._dialog) this._close();
    });

    // Intercept native Escape so our animation runs
    this._dialog?.addEventListener('cancel', (e) => {
      e.preventDefault();
      this._close();
    });

    // Keep in sync with PDP wishlist button changes
    document.addEventListener('wishlist:changed', () => this._refresh());
    document.addEventListener('wishlist:synced', () => this._refresh());

    this._refresh();
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  async _refresh() {
    if (this._isLoggedIn) {
      await this._fetchLoggedIn();
    } else {
      this._readGuest();
    }
    this._updateBadge();
  }

  /** Read GIDs from App Proxy. Does NOT open or render the drawer. */
  async _fetchLoggedIn() {
    try {
      const res = await fetch(`${this._proxyBase}/list`);
      if (!res.ok) throw new Error(`list ${res.status}`);
      const data = await res.json();
      this._list = Array.isArray(data.list) ? data.list : [];
    } catch (err) {
      console.warn('[r-wishlist-header] list fetch failed:', err);
      this._list = [];
    }
  }

  _readGuest() {
    try {
      const stored = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]');
      this._list = Array.isArray(stored) ? stored : [];
    } catch {
      this._list = [];
    }
  }

  /** Fetch product details (including variants) for the current GID list. */
  async _fetchProducts() {
    if (!this._list.length) {
      this._products = [];
      return;
    }
    try {
      const ids = this._list.join(',');
      const res = await fetch(`${this._proxyBase}/products?ids=${encodeURIComponent(ids)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      this._products = Array.isArray(data.products) ? data.products : [];
    } catch (err) {
      console.warn('[r-wishlist-header] products fetch failed:', err);
      this._products = [];
    }
  }

  // ─── Badge ─────────────────────────────────────────────────────────────────

  _updateBadge() {
    const count = this._list.length;
    if (!this._badge) return;
    this._badge.textContent = count > 99 ? '99+' : String(count);
    this._badge.hidden = count === 0;
    if (count > 0) {
      this.setAttribute('data-has-items', '');
    } else {
      this.removeAttribute('data-has-items');
    }
  }

  // ─── Drawer ────────────────────────────────────────────────────────────────

  _toggle() {
    if (this._dialog?.open) {
      this._close();
    } else {
      this._open();
    }
  }

  _open() {
    if (!this._dialog || this._dialog.open) return;

    // Lock body scroll exactly as DialogComponent.showDialog() does
    this._previousScrollY = window.scrollY;

    requestAnimationFrame(() => {
      document.body.style.width = '100%';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this._previousScrollY}px`;
      this._dialog.showModal();
      this._btn?.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => this._dialogHeading?.focus());
    });

    // Fetch and render while the drawer animates in
    this._renderDrawer();
  }

  async _close() {
    if (!this._dialog?.open) return;

    // Mirror DialogComponent.closeDialog()
    this._dialog.style.animation = 'none';
    void this._dialog.offsetWidth;
    this._dialog.classList.add('dialog-closing');
    this._dialog.style.animation = '';

    await new Promise((resolve) => {
      const onEnd = () => {
        this._dialog.removeEventListener('animationend', onEnd);
        resolve(undefined);
      };
      this._dialog.addEventListener('animationend', onEnd);
      setTimeout(resolve, 500);
    });

    document.body.style.width = '';
    document.body.style.position = '';
    document.body.style.top = '';
    window.scrollTo({ top: this._previousScrollY, behavior: 'instant' });

    this._dialog.close();
    this._dialog.classList.remove('dialog-closing');
    this._btn?.setAttribute('aria-expanded', 'false');
    this._btn?.focus();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  async _renderDrawer() {
    this._setLoading(true);

    try {
      if (this._isLoggedIn) {
        await this._fetchLoggedIn();
      } else {
        this._readGuest();
      }
      // Fetch product details for both logged-in and guest.
      // The /products endpoint requires HMAC only (requireAuth: false),
      // so it works through the App Proxy for any visitor.
      await this._fetchProducts();
    } finally {
      // Always clear loading, even on unexpected error
      this._setLoading(false);
    }

    this._updateBadge();

    const count = this._list.length;
    if (this._countLabel) {
      this._countLabel.textContent = count > 0 ? `(${count})` : '';
    }
    if (this._viewAllEl) {
      this._viewAllEl.hidden = count === 0;
    }

    this._listEl.innerHTML = '';

    if (count === 0) {
      this._showEmpty();
      return;
    }

    this._hideEmpty();

    if (this._products.length > 0) {
      this._renderProductList();
      // Show sign-in nudge below the product cards for guests
      if (!this._isLoggedIn && this._guestNoteEl) {
        this._guestNoteEl.hidden = false;
      }
    } else if (this._isLoggedIn) {
      // Products fetch failed for logged-in user — show count only
      this._appendCountOnly(count);
    } else {
      // Guest + products fetch failed — show count + sign-in nudge
      this._appendCountOnly(count, true);
      if (this._guestNoteEl) this._guestNoteEl.hidden = false;
    }
  }

  _appendCountOnly(count, isGuest = false) {
    const li = document.createElement('li');
    li.className = 'r-wishlist-dialog__count-only';
    li.textContent = `${count} item${count === 1 ? '' : 's'} saved${isGuest ? ' locally' : ''}`;
    li.style.cssText = 'padding: 1rem 0; color: inherit; list-style: none;';
    this._listEl.appendChild(li);
  }

  _renderProductList() {
    const map = new Map(this._products.map((p) => [p.id, p]));
    for (const gid of this._list) {
      const product = map.get(gid);
      if (!product) continue;
      this._listEl.appendChild(this._buildItemEl(product, gid));
    }
  }

  /**
   * Build a single wishlist item `<li>` with variant selector and add-to-cart.
   * @param {object} product
   * @param {string} gid
   */
  _buildItemEl(product, gid) {
    const variants = flattenVariants(product.variants);
    // Currency lives on the product level (Admin API variant.price is a scalar)
    const currencyCode = product.priceRange?.minVariantPrice?.currencyCode ?? 'USD';
    // "Default Title" means there's only one option — treat as single-variant
    const isMultiVariant =
      variants.length > 1 ||
      (variants.length === 1 && variants[0].title !== 'Default Title');
    const firstAvailable = variants.find((v) => v.availableForSale) ?? variants[0];
    const defaultVariant = firstAvailable ?? variants[0];

    const productUrl = product.onlineStoreUrl ?? `/products/${product.handle}`;
    const imgUrl = product.featuredImage?.url ?? '';
    const imgAlt = product.featuredImage?.altText ?? product.title;

    const li = document.createElement('li');
    li.className = 'r-wishlist-item';
    li.dataset.productGid = gid;

    // ── Image ──
    const imageHtml = imgUrl
      ? `<img
           src="${this._escapeAttr(imgUrl)}"
           alt="${this._escapeAttr(imgAlt)}"
           class="r-wishlist-item__img"
           width="72" height="72" loading="lazy"
         >`
      : `<span class="r-wishlist-item__img-placeholder" aria-hidden="true">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
             <rect width="24" height="24" rx="2" fill="currentColor" opacity=".1"/>
             <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4 20l4-4 2.5 2.5L14 14l6 6"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
           </svg>
         </span>`;

    // ── Variant options ──
    // Admin API: variant.price is a plain decimal scalar; currency from product level
    const variantOptionsHtml = isMultiVariant
      ? `<select
           class="r-wishlist-item__variant-select"
           aria-label="Select variant for ${this._escapeAttr(product.title)}"
         >
           ${variants
             .map(
               (v) =>
                 `<option
                    value="${this._escapeAttr(v.id)}"
                    data-price="${this._escapeAttr(v.price ?? '0')}"
                    data-currency="${this._escapeAttr(currencyCode)}"
                    data-available="${v.availableForSale ? 'true' : 'false'}"
                    ${v === defaultVariant ? 'selected' : ''}
                  >${this._escapeHtml(v.title)}${!v.availableForSale ? ' — Sold out' : ''}</option>`
             )
             .join('')}
         </select>`
      : '';

    // ── Initial price & availability from defaultVariant ──
    const initialPrice = defaultVariant?.price
      ? formatCurrency(defaultVariant.price, currencyCode)
      : '';
    const initialAvailable = defaultVariant?.availableForSale ?? false;
    const initialVariantGid = defaultVariant?.id ?? '';

    // ── Bottom row: price + ATC / sold-out ──
    const atcHtml = initialAvailable
      ? `<button
           type="button"
           class="r-wishlist-item__atc"
           data-variant-gid="${this._escapeAttr(initialVariantGid)}"
           aria-label="Add ${this._escapeAttr(product.title)} to cart"
         >Add to cart</button>`
      : `<span class="r-wishlist-item__sold-out">Sold out</span>`;

    li.innerHTML = `
      <a href="${productUrl}" class="r-wishlist-item__image-link"
         aria-label="${this._escapeAttr(product.title)}" tabindex="0">
        ${imageHtml}
      </a>
      <div class="r-wishlist-item__info">
        <a href="${productUrl}" class="r-wishlist-item__title">
          ${this._escapeHtml(product.title)}
        </a>
        ${variantOptionsHtml}
        <div class="r-wishlist-item__bottom">
          <span class="r-wishlist-item__price">${initialPrice}</span>
          ${atcHtml}
        </div>
      </div>
      <button
        type="button"
        class="r-wishlist-item__remove"
        aria-label="Remove ${this._escapeAttr(product.title)} from wishlist"
        data-gid="${this._escapeAttr(gid)}"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             aria-hidden="true" focusable="false">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor"
                stroke-width="1.75" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // ── Wire up variant select ──
    if (isMultiVariant) {
      const select = li.querySelector('.r-wishlist-item__variant-select');
      const priceEl = li.querySelector('.r-wishlist-item__price');
      const bottomEl = li.querySelector('.r-wishlist-item__bottom');

      select?.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        const price = opt.dataset.price;
        const currency = opt.dataset.currency;
        const available = opt.dataset.available === 'true';
        const variantGid = opt.value;

        if (priceEl) {
          priceEl.textContent = price ? formatCurrency(price, currency) : '';
        }

        // Swap ATC ↔ sold-out
        const existing = bottomEl?.querySelector('.r-wishlist-item__atc, .r-wishlist-item__sold-out');
        if (existing) existing.remove();

        if (available) {
          const newBtn = document.createElement('button');
          newBtn.type = 'button';
          newBtn.className = 'r-wishlist-item__atc';
          newBtn.dataset.variantGid = variantGid;
          newBtn.setAttribute('aria-label', `Add ${product.title} to cart`);
          newBtn.textContent = 'Add to cart';
          newBtn.addEventListener('click', () => this._addToCart(variantGid, newBtn));
          bottomEl?.appendChild(newBtn);
        } else {
          const soldOut = document.createElement('span');
          soldOut.className = 'r-wishlist-item__sold-out';
          soldOut.textContent = 'Sold out';
          bottomEl?.appendChild(soldOut);
        }
      });
    }

    // ── Wire up add-to-cart ──
    const atcBtn = li.querySelector('.r-wishlist-item__atc');
    if (atcBtn) {
      atcBtn.addEventListener('click', () => {
        const variantGid = /** @type {HTMLButtonElement} */ (atcBtn).dataset.variantGid ?? initialVariantGid;
        this._addToCart(variantGid, /** @type {HTMLButtonElement} */ (atcBtn));
      });
    }

    // ── Wire up remove ──
    li.querySelector('.r-wishlist-item__remove')?.addEventListener('click', () => {
      this._removeItem(gid, li);
    });

    return li;
  }

  // ─── Cart ──────────────────────────────────────────────────────────────────

  /**
   * Add a variant to the Shopify cart and refresh the cart icon count.
   * @param {string} variantGid  e.g. "gid://shopify/ProductVariant/123456"
   * @param {HTMLButtonElement} btn
   */
  async _addToCart(variantGid, btn) {
    const variantId = variantGid.split('/').pop();
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '…';

    try {
      const addRes = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
      });
      if (!addRes.ok) throw new Error(String(addRes.status));

      // Dispatch 'cart:update' so all cart components (icon badge,
      // cart-items, etc.) refresh their state. However cart-drawer.js also
      // listens for this event and auto-opens when it has the `auto-open`
      // attribute — which would cover the wishlist dialog. We temporarily
      // suppress that attribute during the synchronous dispatch cycle.
      const cartRes = await fetch('/cart.js');
      if (cartRes.ok) {
        const cart = await cartRes.json();
        const cartDrawer = document.querySelector('cart-drawer');
        const hadAutoOpen = cartDrawer?.hasAttribute('auto-open');
        if (hadAutoOpen) cartDrawer.removeAttribute('auto-open');

        document.dispatchEvent(
          new CustomEvent('cart:update', {
            bubbles: true,
            detail: {
              resource: cart,
              sourceId: 'r-wishlist-header',
              data: { itemCount: cart.item_count },
            },
          })
        );

        if (hadAutoOpen) cartDrawer.setAttribute('auto-open', '');
      }

      btn.textContent = '✓ Added';
      setTimeout(() => {
        btn.textContent = originalLabel;
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.warn('[r-wishlist-header] add to cart failed:', err);
      btn.textContent = originalLabel;
      btn.disabled = false;
    }
  }

  // ─── Remove ────────────────────────────────────────────────────────────────

  async _removeItem(gid, liEl) {
    if (!this._isLoggedIn) {
      // Guest: update localStorage directly
      this._list = this._list.filter((id) => id !== gid);
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(this._list));
      } catch {}

      liEl.remove();
      this._products = this._products.filter((p) => p.id !== gid);

      this._updateBadge();
      const guestCount = this._list.length;
      if (this._countLabel) {
        this._countLabel.textContent = guestCount > 0 ? `(${guestCount})` : '';
      }
      if (this._viewAllEl) this._viewAllEl.hidden = guestCount === 0;
      if (guestCount === 0) this._showEmpty();

      document.dispatchEvent(
        new CustomEvent('wishlist:changed', {
          detail: { action: 'remove', productGid: gid, isLoggedIn: false },
          bubbles: true,
        })
      );
      return;
    }

    try {
      const res = await fetch(`${this._proxyBase}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productGid: gid }),
      });
      if (!res.ok) throw new Error(String(res.status));

      liEl.remove();
      this._list = this._list.filter((id) => id !== gid);
      this._products = this._products.filter((p) => p.id !== gid);

      this._updateBadge();
      const count = this._list.length;
      if (this._countLabel) {
        this._countLabel.textContent = count > 0 ? `(${count})` : '';
      }
      if (this._viewAllEl) this._viewAllEl.hidden = count === 0;
      if (count === 0) this._showEmpty();

      document.dispatchEvent(
        new CustomEvent('wishlist:changed', {
          detail: { action: 'remove', productGid: gid, isLoggedIn: true },
          bubbles: true,
        })
      );
    } catch {
      // Silent fail; state refreshes on next open
    }
  }

  // ─── State helpers ─────────────────────────────────────────────────────────

  _setLoading(on) {
    this._loading = on;
    // Use a CSS class rather than [hidden] so the display: flex in CSS doesn't
    // interfere with the hidden attribute's display: none.
    if (this._loadingEl) {
      this._loadingEl.classList.toggle('r-wishlist-dialog__loading--visible', on);
    }
    if (this._contentEl) {
      this._contentEl.setAttribute('aria-busy', on ? 'true' : 'false');
    }
    if (on) {
      this._listEl.innerHTML = '';
      this._hideEmpty();
    }
  }

  _showEmpty() {
    if (this._emptyEl) this._emptyEl.hidden = false;
    if (this._viewAllEl) this._viewAllEl.hidden = true;
  }

  _hideEmpty() {
    if (this._emptyEl) this._emptyEl.hidden = true;
    if (this._guestNoteEl) this._guestNoteEl.hidden = true;
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

customElements.define('r-wishlist-header', RWishlistHeader);
