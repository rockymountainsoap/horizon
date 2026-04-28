import { describe, it, expect } from 'vitest';
import { validateCustomerId, validateProductGid } from './validate.js';
import { ValidationError, AuthError } from '../utils/errors.js';

describe('validateCustomerId', () => {
  it('accepts numeric string', () => {
    expect(validateCustomerId('12345')).toBe('12345');
  });

  it('rejects empty', () => {
    expect(() => validateCustomerId('')).toThrow(AuthError);
  });

  it('rejects non-numeric', () => {
    expect(() => validateCustomerId('abc')).toThrow(AuthError);
  });
});

describe('validateProductGid', () => {
  it('accepts valid GID', () => {
    expect(validateProductGid('gid://shopify/Product/1')).toBe('gid://shopify/Product/1');
  });

  it('rejects invalid GID', () => {
    expect(() => validateProductGid('not-a-gid')).toThrow(ValidationError);
  });
});
