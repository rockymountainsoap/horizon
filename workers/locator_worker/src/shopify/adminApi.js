import {
  ADMIN_API_VERSION,
  STORE_LOCATION_TYPE,
  STORES_PAGE_SIZE,
  INVENTORY_LEVELS_PAGE_SIZE,
} from '../config.js';
import { NotFoundError, UpstreamError } from '../utils/errors.js';
import { evictAdminToken, getAdminToken } from './tokens.js';

/**
 * Execute a GraphQL query against the Shopify Admin API.
 *
 * Retries once on a 401 by evicting the cached token and re-exchanging
 * client credentials — Shopify can revoke a cached `shpat_*` before its
 * advertised `expires_in`, and a single retry covers that race.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export async function adminFetch(env, shop, query, variables = {}) {
  const url = `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const forceRefresh = attempt > 0;
    const token = await getAdminToken(env, shop, { forceRefresh });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 401 && attempt === 0) {
      console.warn('[adminApi] 401 from Shopify — evicting cached token and retrying');
      await evictAdminToken(env);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[adminApi] HTTP error:', res.status, text);
      throw new UpstreamError(`Shopify Admin HTTP ${res.status}`, 502);
    }

    const body = await res.json().catch(() => ({}));

    if (body.errors?.length) {
      console.error('[adminApi] GraphQL errors:', JSON.stringify(body.errors));
      throw new UpstreamError(body.errors[0]?.message ?? 'GraphQL error', 502);
    }

    return body.data ?? {};
  }

  // Should be unreachable — the loop above either returns or throws.
  throw new UpstreamError('Admin API exhausted retries', 502);
}

/** Safely parse a metafield value that may be JSON-encoded. */
function safeParse(raw) {
  if (raw == null || raw === '') return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

/** Strip the trailing numeric segment from a Shopify GID. */
function gidTail(gid) {
  return typeof gid === 'string' ? gid.split('/').pop() : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Store locations
// ─────────────────────────────────────────────────────────────────────────────

const STORE_LOCATIONS_LIST_QUERY = `
  query StoreLocations($type: String!, $first: Int!, $query: String) {
    metaobjects(type: $type, first: $first, query: $query) {
      edges {
        node {
          id
          handle
          name:               field(key: "name")                 { value }
          address:            field(key: "address")              { value }
          city:               field(key: "city")                 { value }
          province:           field(key: "province")             { value }
          phone:              field(key: "phone")                { value }
          coordinates:        field(key: "coordinates")          { value }
          mapsUrl:            field(key: "maps_url")             { value }
          shopifyLocationId:  field(key: "shopify_location_id")  { value }
          locationType:       field(key: "location_type")        { value }
          cityGroup:          field(key: "city_group")           { value }
          hasEmail:           field(key: "email")                { value }
        }
      }
    }
  }
`;

const STORE_LOCATION_DETAIL_QUERY = `
  query StoreLocation($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      handle
      fields {
        key
        value
        reference {
          ... on MediaImage { image { url(transform: { maxWidth: 1200 }) } }
          ... on Video      { preview { image { url } } }
          ... on GenericFile { url }
        }
        references(first: 25) {
          edges {
            node {
              ... on MediaImage  { image { url(transform: { maxWidth: 1200 }) } }
              ... on Video       { preview { image { url } } }
              ... on GenericFile { url }
              ... on Metaobject {
                type
                fields {
                  key
                  value
                  reference {
                    ... on MediaImage  { image { url(transform: { maxWidth: 800 }) } }
                    ... on GenericFile { url }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const STORE_LOCATION_EMAIL_QUERY = `
  query StoreLocationEmail($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      email: field(key: "email") { value }
    }
  }
`;

/**
 * Light list of store_location metaobjects. Strips heavy fields
 * (description, hours, images, events) — fetch those via fetchStoreLocation().
 *
 * Pass `locationType` to push a server-side filter to Shopify's
 * `query: "fields.location_type:<value>"` parameter — the Worker never
 * receives the unmatched records over the wire. Omit it (or pass null)
 * to return every store_location entry.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop
 * @param {{ locationType?: string | null }} [opts]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchStoreLocations(env, shop, opts = {}) {
  const filter = opts.locationType
    ? `fields.location_type:${opts.locationType}`
    : null;

  const data = await adminFetch(env, shop, STORE_LOCATIONS_LIST_QUERY, {
    type: STORE_LOCATION_TYPE,
    first: STORES_PAGE_SIZE,
    query: filter,
  });

  const edges = data.metaobjects?.edges ?? [];
  return edges.map((edge) => {
    const node = edge.node ?? {};
    return {
      id: gidTail(node.id),
      handle: node.handle ?? '',
      name: node.name?.value ?? '',
      address: node.address?.value ?? '',
      city: node.city?.value ?? '',
      province: node.province?.value ?? '',
      phone: node.phone?.value ?? '',
      coordinates: safeParse(node.coordinates?.value),
      maps_url: node.mapsUrl?.value ?? '',
      shopify_location_id: node.shopifyLocationId?.value ?? '',
      location_type: node.locationType?.value ?? '',
      city_group: node.cityGroup?.value ?? '',
      has_email: Boolean(node.hasEmail?.value),
      url: `/pages/store-locator/${node.handle ?? ''}`,
    };
  });
}

/**
 * Full details for a single store_location metaobject.
 * Throws NotFoundError when the handle does not resolve.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop
 * @param {string} handle
 */
export async function fetchStoreLocation(env, shop, handle) {
  const data = await adminFetch(env, shop, STORE_LOCATION_DETAIL_QUERY, {
    handle: { type: STORE_LOCATION_TYPE, handle },
  });

  const node = data.metaobjectByHandle;
  if (!node) throw new NotFoundError(`Store '${handle}' not found`);

  /** @type {Record<string, any>} */
  const fields = {};
  for (const f of node.fields ?? []) fields[f.key] = f;

  const images = collectImages(fields.images);
  const events = collectEvents(fields.events);

  return {
    id: gidTail(node.id),
    handle: node.handle,
    name: fields.name?.value ?? '',
    address: fields.address?.value ?? '',
    city: fields.city?.value ?? '',
    province: fields.province?.value ?? '',
    phone: fields.phone?.value ?? '',
    coordinates: safeParse(fields.coordinates?.value),
    maps_url: fields.maps_url?.value ?? '',
    shopify_location_id: fields.shopify_location_id?.value ?? '',
    location_type: fields.location_type?.value ?? '',
    city_group: fields.city_group?.value ?? '',
    has_email: Boolean(fields.email?.value),
    hours: safeParse(fields.hours?.value) ?? {},
    description: fields.description?.value ?? '',
    images,
    events,
    url: `/pages/store-locator/${node.handle}`,
  };
}

/**
 * Resolve only the email field for a single store. Used by /stores/:handle/email
 * — never cached at edge.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop
 * @param {string} handle
 */
export async function fetchStoreLocationEmail(env, shop, handle) {
  const data = await adminFetch(env, shop, STORE_LOCATION_EMAIL_QUERY, {
    handle: { type: STORE_LOCATION_TYPE, handle },
  });
  const node = data.metaobjectByHandle;
  if (!node) throw new NotFoundError(`Store '${handle}' not found`);
  return node.email?.value ?? '';
}

/**
 * Pull every URL out of a list.file_reference field on a metaobject. Tolerant
 * of MediaImage / Video / GenericFile references plus the fallback raw GIDs.
 *
 * @param {Record<string, any> | undefined} field
 * @returns {string[]}
 */
function collectImages(field) {
  if (!field) return [];
  const out = [];

  for (const edge of field.references?.edges ?? []) {
    const ref = edge.node;
    const url =
      ref?.image?.url ??
      ref?.url ??
      ref?.preview?.image?.url;
    if (typeof url === 'string' && url) out.push(url);
  }

  if (field.reference) {
    const ref = field.reference;
    const url = ref.image?.url ?? ref.url ?? ref.preview?.image?.url;
    if (typeof url === 'string' && url && !out.includes(url)) out.push(url);
  }

  return out;
}

/**
 * Hydrate the `events` field into an array of plain event objects. Returns
 * an empty array when the field is missing or empty.
 *
 * @param {Record<string, any> | undefined} field
 * @returns {Array<{ name: string; date: string; description: string; cta: string; image: string }>}
 */
function collectEvents(field) {
  if (!field?.references?.edges) return [];
  const events = [];

  for (const edge of field.references.edges) {
    const node = edge.node;
    if (!node?.type || !node.type.includes('event')) continue;

    /** @type {Record<string, any>} */
    const ef = {};
    for (const f of node.fields ?? []) ef[f.key] = f;

    const imageRef = ef.event_image?.reference;
    const image =
      imageRef?.image?.url ??
      imageRef?.url ??
      imageRef?.preview?.image?.url ??
      '';

    events.push({
      name: ef.event_name?.value ?? '',
      date: ef.event_date_time?.value ?? '',
      description: ef.event_description?.value ?? '',
      cta: ef.event_cta?.value ?? '',
      image,
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory by variant
// ─────────────────────────────────────────────────────────────────────────────

const INVENTORY_BY_VARIANT_QUERY = `
  query InventoryByVariant($id: ID!, $first: Int!) {
    productVariant(id: $id) {
      id
      inventoryItem {
        inventoryLevels(first: $first) {
          edges {
            node {
              location { id }
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    }
  }
`;

/**
 * Live per-location inventory for a variant.
 * Returns an array of `{ locationId, available }` objects, one per inventory
 * level. Returns [] when the variant has no inventory item or no levels.
 *
 * @param {Record<string, unknown>} env
 * @param {string} shop
 * @param {string} variantId  Numeric (no "gid://" prefix)
 */
export async function fetchInventoryByVariant(env, shop, variantId) {
  const data = await adminFetch(env, shop, INVENTORY_BY_VARIANT_QUERY, {
    id: `gid://shopify/ProductVariant/${variantId}`,
    first: INVENTORY_LEVELS_PAGE_SIZE,
  });

  const variant = data.productVariant;
  if (!variant) throw new NotFoundError(`Variant ${variantId} not found`);

  const edges = variant.inventoryItem?.inventoryLevels?.edges ?? [];

  return edges
    .map((edge) => {
      const node = edge.node ?? {};
      const locationId = Number(gidTail(node.location?.id));
      const availableEntry = (node.quantities ?? []).find((q) => q?.name === 'available');
      const available = Number(availableEntry?.quantity ?? 0);
      if (!Number.isFinite(locationId) || locationId <= 0) return null;
      return { locationId, available };
    })
    .filter(Boolean);
}
