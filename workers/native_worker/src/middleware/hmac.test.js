import { describe, it, expect } from 'vitest';
import { verifyShopifyHmac } from './hmac.js';

describe('verifyShopifyHmac', () => {
  it('returns false when signature is missing', async () => {
    const url = 'https://example.com/wishlist/list?shop=test.myshopify.com&timestamp=123';
    expect(await verifyShopifyHmac(url, 'secret', 300)).toBe(false);
  });

  it('returns false when secret is empty', async () => {
    const url = 'https://example.com/wishlist/list?signature=abc&timestamp=1';
    expect(await verifyShopifyHmac(url, '', 300)).toBe(false);
  });
});
