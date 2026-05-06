import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminToken, _resetMemoryCacheForTests, normalizeShopHost } from './tokens.js';

const SHOP = 'rocky-horizon-development.myshopify.com';

function makeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    put: vi.fn(async (key, value) => { store.set(key, value); }),
    _store: store,
  };
}

beforeEach(() => {
  _resetMemoryCacheForTests();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeShopHost', () => {
  it('returns canonical hostname', () => {
    expect(normalizeShopHost(SHOP)).toBe(SHOP);
  });

  it('strips protocol and path', () => {
    expect(normalizeShopHost(`https://${SHOP}/admin/`)).toBe(SHOP);
  });

  it('returns empty for non-myshopify hosts', () => {
    expect(normalizeShopHost('rockymountainsoap.com')).toBe('');
  });
});

describe('getAdminToken', () => {
  it('returns the KV-cached token without hitting Shopify', async () => {
    const kv = makeKv({ cc_access_token: 'kv-token' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const token = await getAdminToken(
      { APP_KV: kv, SHOP_DOMAIN: SHOP, SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'secret' },
      SHOP
    );

    expect(token).toBe('kv-token');
    expect(kv.get).toHaveBeenCalledWith('cc_access_token');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('exchanges client credentials when no cache exists, then writes to KV', async () => {
    const kv = makeKv();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'fresh-token', expires_in: 86399 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const token = await getAdminToken(
      { APP_KV: kv, SHOP_DOMAIN: SHOP, SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'secret' },
      SHOP
    );

    expect(token).toBe('fresh-token');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(`https://${SHOP}/admin/oauth/access_token`);
    expect(calledInit.method).toBe('POST');
    const body = String(calledInit.body);
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=id');
    expect(body).toContain('client_secret=secret');

    expect(kv.put).toHaveBeenCalledWith(
      'cc_access_token',
      'fresh-token',
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    );
  });

  it('reuses the in-memory cache on a second call within the same isolate', async () => {
    const kv = makeKv();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'mem-token', expires_in: 86399 }), { status: 200 })
    );

    const env = { APP_KV: kv, SHOP_DOMAIN: SHOP, SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'secret' };

    const a = await getAdminToken(env, SHOP);
    const b = await getAdminToken(env, SHOP);

    expect(a).toBe('mem-token');
    expect(b).toBe('mem-token');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // second call hit memory cache
  });

  it('throws when client credentials are missing', async () => {
    const kv = makeKv();
    await expect(
      getAdminToken({ APP_KV: kv, SHOP_DOMAIN: SHOP }, SHOP)
    ).rejects.toThrow(/SHOPIFY_CLIENT_ID|SHOPIFY_CLIENT_SECRET/);
  });

  it('throws on a 401 from Shopify', async () => {
    const kv = makeKv();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })
    );

    await expect(
      getAdminToken(
        { APP_KV: kv, SHOP_DOMAIN: SHOP, SHOPIFY_CLIENT_ID: 'id', SHOPIFY_CLIENT_SECRET: 'bad' },
        SHOP
      )
    ).rejects.toThrow(/Token exchange failed/);
  });
});
