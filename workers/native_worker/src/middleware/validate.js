import { AuthError, ValidationError } from '../utils/errors.js';

const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const CUSTOMER_ID_REGEX = /^\d+$/;

export function validateCustomerId(id) {
  if (!id || id === 'null' || id === '0' || id === '') {
    throw new AuthError('Authentication required');
  }
  if (!CUSTOMER_ID_REGEX.test(id)) {
    throw new AuthError('Invalid customer identity');
  }
  return id;
}

export function validateProductGid(gid) {
  if (typeof gid !== 'string' || !gid) {
    throw new ValidationError('productGid is required');
  }
  if (!PRODUCT_GID_REGEX.test(gid)) {
    throw new ValidationError('Invalid productGid format');
  }
  return gid;
}

export function validateGidArray(gids) {
  if (!Array.isArray(gids)) throw new ValidationError('Expected array of GIDs');
  if (gids.length > 250) throw new ValidationError('Exceeds maximum list size');
  return gids.map(validateProductGid);
}

export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
}
