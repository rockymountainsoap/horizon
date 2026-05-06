import { ValidationError } from '../utils/errors.js';

/** Shopify metaobject handles are slug-shaped: lowercase, digits, hyphens. */
const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,127}[a-z0-9])?$/;

/** Shopify variant IDs are positive integers. */
const NUMERIC_ID_REGEX = /^[1-9][0-9]{0,19}$/;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function validateHandle(raw) {
  if (typeof raw !== 'string') {
    throw new ValidationError('handle is required');
  }
  const handle = raw.trim().toLowerCase();
  if (!HANDLE_REGEX.test(handle)) {
    throw new ValidationError('Invalid store handle');
  }
  return handle;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function validateNumericId(raw) {
  if (raw == null || raw === '') {
    throw new ValidationError('variantId is required');
  }
  const id = String(raw).trim();
  if (!NUMERIC_ID_REGEX.test(id)) {
    throw new ValidationError('Invalid variantId');
  }
  return id;
}
