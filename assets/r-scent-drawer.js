/**
 * <r-scent-drawer> — bridges the combined-listing Scent drawer to the native
 * variant flow. The drawer's scent buttons (`[data-r-scent-value]`) drive a real,
 * visually-hidden <select> that lives inside <variant-picker>; setting its value
 * and dispatching a bubbling `change` runs variant-picker.js `variantChanged()`
 * verbatim — including the combined-listing `main` morph and history update.
 *
 * No engine changes: this only wires DOM the theme already produces.
 */
class RScentDrawer extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.#onClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.#onClick);
  }

  /** @param {MouseEvent} event */
  #onClick = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest('[data-r-scent-value]');
    if (!option || !this.contains(option)) return;

    const value = option.getAttribute('data-r-scent-value');
    const select = /** @type {HTMLSelectElement | null} */ (this.querySelector('[data-r-scent-select]'));
    if (value == null || !select) return;

    // Close the drawer first so scroll-lock is released before the morph.
    const dialog = this.querySelector('dialog-component');
    if (dialog && typeof dialog.closeDialog === 'function') dialog.closeDialog();

    // Only navigate when the scent actually changes.
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));

      // Mirror the URL synchronously so refresh / share / back always land on
      // the sibling product. variant-picker.js schedules the same update via a
      // deferred yieldToMainThread(), which can be delayed or dropped in
      // deprioritized/background contexts — this is idempotent with it (both
      // guard on href equality), never conflicting.
      const chosen = select.options[select.selectedIndex];
      const connectedUrl = chosen?.dataset.connectedProductUrl;
      if (connectedUrl) {
        const url = new URL(window.location.href);
        url.pathname = connectedUrl;
        const variantId = chosen?.dataset.variantId;
        if (variantId) url.searchParams.set('variant', variantId);
        if (url.href !== window.location.href) history.replaceState({}, '', url.toString());
      }
    }
  };
}

if (!customElements.get('r-scent-drawer')) {
  customElements.define('r-scent-drawer', RScentDrawer);
}
