import { ADMIN_API_VERSION } from '../config.js';

const KLAVIYO_BASE = 'https://a.klaviyo.com';

/**
 * POST to a Klaviyo v3 endpoint. Logs non-2xx responses but never throws —
 * a Klaviyo outage must not affect wishlist responses.
 *
 * @param {Record<string, unknown>} env
 * @param {string} path
 * @param {unknown} body
 */
async function klaviyoPost(env, path, body) {
  const revision = String(env.KLAVIYO_API_REVISION ?? '2024-10-15');
  const key = String(env.KLAVIYO_PRIVATE_KEY);

  const res = await fetch(`${KLAVIYO_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Klaviyo-API-Key ${key}`,
      revision,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[klaviyo] POST ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * Fetch title, handle, featuredImage, and first variant price for a product.
 * Returns null on any failure — event is still sent without enrichment.
 *
 * @param {string} shop
 * @param {string} token
 * @param {string} productGid
 * @returns {Promise<{ title: string; handle: string; imageUrl: string | null; price: number | null } | null>}
 */
async function fetchProductDetails(shop, token, productGid) {
  try {
    const res = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: `query KlaviyoProduct($id: ID!) {
          product(id: $id) {
            title
            handle
            featuredImage { url }
            variants(first: 1) { edges { node { price } } }
          }
        }`,
        variables: { id: productGid },
      }),
    });

    const data = await res.json();
    const p = data.data?.product;
    if (!p) return null;

    return {
      title: p.title,
      handle: p.handle,
      imageUrl: p.featuredImage?.url ?? null,
      price: parseFloat(p.variants?.edges?.[0]?.node?.price ?? '') || null,
    };
  } catch {
    return null;
  }
}

/**
 * Build the JSONAPI profile body used for profile-import.
 *
 * @param {string} email
 * @param {string} customerId  Numeric Shopify customer ID
 * @param {Record<string, unknown>} properties
 */
function buildProfileBody(email, customerId, properties) {
  return {
    data: {
      type: 'profile',
      attributes: { email, external_id: customerId, properties },
    },
  };
}

/**
 * Fire "Added to Wishlist" or "Removed from Wishlist" Klaviyo event and
 * update the customer's profile properties.
 *
 * Designed to run inside ctx.waitUntil() — after the wishlist response is sent.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop              myshopify domain, e.g. "store.myshopify.com"
 * @param {string} adminToken
 * @param {string} customerId        Numeric Shopify customer ID
 * @param {string} email
 * @param {'add' | 'remove'} action
 * @param {string} productGid
 * @param {string[]} updatedList     Full wishlist after the mutation
 */
export async function syncWishlistChange(
  env,
  shop,
  adminToken,
  customerId,
  email,
  action,
  productGid,
  updatedList
) {
  try {
    const product = await fetchProductDetails(shop, adminToken, productGid);
    const shopDomain = String(env.SHOP_MYSHOPIFY_DOMAIN ?? env.SHOP_DOMAIN ?? shop);
    const eventName = action === 'add' ? 'Added to Wishlist' : 'Removed from Wishlist';

    /** @type {Record<string, unknown>} */
    const eventProperties = {
      ProductID: productGid,
      WishlistCount: updatedList.length,
    };

    if (product) {
      eventProperties.ProductTitle = product.title;
      eventProperties.ProductURL = `https://${shopDomain}/products/${product.handle}`;
      if (product.imageUrl) eventProperties.ProductImageURL = product.imageUrl;
    }

    await klaviyoPost(env, '/api/events/', {
      data: {
        type: 'event',
        attributes: {
          profile: {
            data: {
              type: 'profile',
              attributes: { email, external_id: customerId },
            },
          },
          metric: {
            data: { type: 'metric', attributes: { name: eventName } },
          },
          properties: eventProperties,
          ...(product?.price != null ? { value: product.price } : {}),
        },
      },
    });

    await klaviyoPost(
      env,
      '/api/profile-import/',
      buildProfileBody(email, customerId, {
        WishlistCount: updatedList.length,
        WishlistProductGids: updatedList,
      })
    );
  } catch (e) {
    console.error('[klaviyo] syncWishlistChange failed:', e?.message ?? e);
  }
}

/**
 * Update Klaviyo profile properties after a guest-to-server merge.
 * No per-item events are fired — merge can involve many items at once.
 *
 * @param {Record<string, unknown>} env
 * @param {string} customerId
 * @param {string} email
 * @param {string[]} updatedList
 */
export async function syncWishlistMerge(env, customerId, email, updatedList) {
  try {
    await klaviyoPost(
      env,
      '/api/profile-import/',
      buildProfileBody(email, customerId, {
        WishlistCount: updatedList.length,
        WishlistProductGids: updatedList,
      })
    );
  } catch (e) {
    console.error('[klaviyo] syncWishlistMerge failed:', e?.message ?? e);
  }
}
