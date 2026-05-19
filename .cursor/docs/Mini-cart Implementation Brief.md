
## I. Global Branding & Navigation Architecture

The mini-cart acts as the final "vibe check" before a customer commits to a purchase. It must balance Rocky Mountain Soap’s natural aesthetic with the high-fashion, minimalist structure of your brand’s design system.
    
- **Visual Variant Accuracy:** Product thumbnails are dynamically synced to the selected variant. If a customer adds a "1 Litre Everything Wash," the image must reflect the bulk jug, not the standard pump bottle, to manage expectations and provide visual confirmation of value.
    
- **Social Trust & Reassurance Block:** Positioned immediately above the checkout button, this minimalist block features three low-profile icons with brief text summaries:
        
    - **Satisfaction:** "Freshness Guarantee" or "100% Satisfaction" to reinforce product quality.
        
    - **Returns:** "Easy 30-Day Returns" to lower the perceived risk of the transaction.
        
    - **Stars:** A compact row of five filled star icons alongside the aggregate rating score (e.g., "4.9 ★") and the social-proof label **"Loved by 50,000+ Customers."** The entire element is a hyperlink — the label routes to the store-wide reviews page and the rating routes to the product's own review anchor — reinforcing purchase confidence at the moment of highest intent.
        

- **Empty Cart State:** When the cart contains no items the drawer does not render a blank shell. Instead, the item list area is replaced with a curated merchandising block: a "Start Here" heading followed by a short row of bestseller thumbnails pulled from a pinned collection, each with a one-click "Add" button. A brief brand line ("Your next favourite thing is one step away.") sits above the grid to maintain tone. This transforms an abandoned state into a re-engagement surface.

- **Low-Stock & Scarcity Indicators:** Each line item checks its available inventory at render time via the Section Rendering API. If a variant's inventory quantity falls at or below a defined threshold (e.g., ≤ 5 units), a compact inline badge — **"Only [X] left"** — appears directly beneath the product title in high-contrast but restrained styling (e.g., warm amber, not alarming red). The badge is suppressed for items with inventory tracking disabled or set to "continue selling when out of stock," preventing false urgency on made-to-order items.

---

## II. Gamified Incentive Engine (Tiered Progress)

This engine utilizes a "shipping-threshold" dummy product to handle complex multi-currency conversions natively within Shopify Markets, ensuring the math is always accurate regardless of the shopper's location.

- **Dual-Tier Logic:**
    
    - **Tier 1 ($60):** Unlocks Free Shipping.
        
    - **Tier 2 ($100):** Unlocks a Free Gift (e.g., a curated travel-size soap or accessory).
        
- **The Progress Visual:** A thin, geometric bar pinned to the top of the drawer. The fill uses an eased CSS transition to "grow" as items are added, providing immediate visual gratification.
    
- **Dynamic Language Strategy:** The messaging above the bar shifts based on the "delta" (the remaining amount) to create a sense of progress:
    
    - **Under $60:** "Add $[Amount] for Free Shipping."
        
    - **At $60:** "You've unlocked Free Shipping! Add $[Amount] for a Free Gift."
        
    - **At $100+:** "Congratulations! Free Shipping & Your Free Gift are included."
        
- **Section Rendering Sync:** Using the Section Rendering API, the bar and its associated logic are re-rendered on the server after every cart update, preventing "flicker" and ensuring the math is never out of sync with the checkout.

- **Theme Editor Configuration:** All tier logic is exposed as merchant-editable settings within the `cart-drawer` section schema, requiring zero code changes to adjust thresholds or swap the free gift. The following controls are available in the Shopify Theme Editor (Customize):

    - **Tier 1 Threshold:** A numeric input for the free shipping unlock amount (default: $60). Changing this value automatically updates the progress bar calculation, the dynamic language messaging, and the Cart Bumper interception window.

    - **Tier 2 Threshold:** A numeric input for the free gift unlock amount (default: $100). Must be set higher than Tier 1; a validation note in the schema enforces this.

    - **Free Gift Product:** A product picker that stores the selected product's handle. The Section Rendering logic uses this handle to identify, auto-add, and auto-remove the correct zero-price line item. If no product is selected, the Tier 2 reward state is suppressed entirely and the bar treats $60 as the final milestone.

    - **Tier 1 & Tier 2 Label Overrides:** Optional text fields for each dynamic messaging string, allowing copy to be updated seasonally (e.g., swapping "Free Gift" for "Holiday Surprise") without touching Liquid.
    

- **Free Gift Reveal Mechanic:** Once the cart subtotal crosses the Tier 2 threshold, the designated free gift product is automatically added as a zero-price line item — no customer action required. It renders in the cart as a distinct line item with a **"Free Gift"** badge in place of a price and a locked quantity control (non-editable, non-removable by the customer). If the subtotal subsequently drops below $100 — through item removal or quantity reduction — the gift line item is automatically removed in the same Section Rendering API response, with the progress bar reverting to the "almost there" state. All add/remove logic is handled server-side to prevent manipulation via client-side tampering.

---

## III. Dynamic Upsell Interception ("Cart Bumpers")

Traditional cross-sells often fail because they recommend more of what the user already has (e.g., suggesting a third hand wash). This system replaces generic suggestions with "Cart Bumpers"—low-ticket, high-margin items specifically chosen to bridge the gap to the next reward tier.

- **The Interception Logic:** When the customer is within a specific "sweet spot" of a tier (e.g., $1.00 to $15.00 away from free shipping), the standard recommendation engine is overridden.
    
- **Curated "Bumper" Selection:** The system pulls from a specific collection of impulse buys. It filters for items where the price is less than or equal to the amount needed to hit the next tier plus a small buffer.
    
- **Contextual Framing:** The header for this section changes to be more helpful. Instead of "People also added," it displays: _"You're so close! Add one of these to ship for free."_
    
- **One-Click Integration:** These items feature a simplified "Add" button that triggers an AJAX update, instantly refreshing the progress bar and moving the user into the "Unlocked" state.
