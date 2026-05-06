import { describe, it, expect } from 'vitest';
import { validateHandle, validateNumericId } from './validate.js';
import { ValidationError } from '../utils/errors.js';

describe('validateHandle', () => {
  it('accepts a kebab-case slug', () => {
    expect(validateHandle('banff-banff-avenue')).toBe('banff-banff-avenue');
  });

  it('lowercases the handle', () => {
    expect(validateHandle('Calgary-Chinook-Centre')).toBe('calgary-chinook-centre');
  });

  it('rejects empty', () => {
    expect(() => validateHandle('')).toThrow(ValidationError);
  });

  it('rejects non-string', () => {
    expect(() => validateHandle(null)).toThrow(ValidationError);
    expect(() => validateHandle(123)).toThrow(ValidationError);
  });

  it('rejects path-traversal characters', () => {
    expect(() => validateHandle('../etc/passwd')).toThrow(ValidationError);
    expect(() => validateHandle('foo/bar')).toThrow(ValidationError);
    expect(() => validateHandle('foo bar')).toThrow(ValidationError);
  });

  it('rejects leading or trailing hyphen', () => {
    expect(() => validateHandle('-foo')).toThrow(ValidationError);
    expect(() => validateHandle('foo-')).toThrow(ValidationError);
  });
});

describe('validateNumericId', () => {
  it('accepts a positive integer string', () => {
    expect(validateNumericId('44095932465261')).toBe('44095932465261');
  });

  it('coerces a number to a string', () => {
    expect(validateNumericId(123)).toBe('123');
  });

  it('rejects empty', () => {
    expect(() => validateNumericId('')).toThrow(ValidationError);
    expect(() => validateNumericId(null)).toThrow(ValidationError);
    expect(() => validateNumericId(undefined)).toThrow(ValidationError);
  });

  it('rejects zero or negative', () => {
    expect(() => validateNumericId('0')).toThrow(ValidationError);
    expect(() => validateNumericId('-1')).toThrow(ValidationError);
  });

  it('rejects non-numeric', () => {
    expect(() => validateNumericId('abc')).toThrow(ValidationError);
    expect(() => validateNumericId('1.5')).toThrow(ValidationError);
    expect(() => validateNumericId("12; DROP TABLE")).toThrow(ValidationError);
  });
});
