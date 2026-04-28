import VariantPicker from '@theme/variant-picker';

/**
 * Custom element backing the text-pill variant picker on product cards.
 *
 * Why this exists (and is distinct from `swatches-variant-picker-component`):
 *
 *   When a pill is clicked, `VariantPicker.fetchUpdatedSection` requests the
 *   `section-rendering-product-card` section and then morphs whatever element
 *   matches `this.tagName` from the response into `this`. The upstream section
 *   only renders `<swatches-variant-picker-component>` (color swatches), so if
 *   we shared that tag the response would contain an empty/foreign picker and
 *   morph would wipe our pills.
 *
 *   Using a distinct tag means the response (which we extend in
 *   `sections/section-rendering-product-card.liquid` to also render
 *   `variant-buttons`) contains a matching `<variant-buttons-component>` and
 *   the morph swaps in the freshly-rendered pills with the new variant
 *   pre-checked.
 *
 * @extends {VariantPicker}
 */
class VariantButtonsComponent extends VariantPicker {
  /**
   * Override `buildRequestUrl` to force `section_id=section-rendering-product-card`.
   *
   * The base implementation only adds `section_id` for a hard-coded list of
   * ancestor tags (see SECTION_ID_MAP in variant-picker.js). Rather than touch
   * that upstream file, we set the section id ourselves so the request returns
   * the lightweight product-card section instead of the full PDP.
   *
   * @param {HTMLElement} selectedOption
   * @param {string | null} [source]
   * @param {string[]} [sourceSelectedOptionsValues]
   * @returns {string}
   */
  buildRequestUrl(selectedOption, source = null, sourceSelectedOptionsValues = []) {
    const baseUrl = super.buildRequestUrl(selectedOption, source, sourceSelectedOptionsValues);

    if (baseUrl.includes('section_id=')) return baseUrl;

    const [path, query = ''] = baseUrl.split('?');
    return `${path}?section_id=section-rendering-product-card${query ? `&${query}` : ''}`;
  }
}

if (!customElements.get('variant-buttons-component')) {
  customElements.define('variant-buttons-component', VariantButtonsComponent);
}
