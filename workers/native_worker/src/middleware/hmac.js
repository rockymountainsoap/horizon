function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verify Shopify App Proxy HMAC (query params include signature, timestamp, shop, etc.)
 * @param {string} url - Full request URL including query string
 * @param {string} secret - App client secret (SHOPIFY_PROXY_SECRET)
 * @param {number} [maxAgeSeconds=300]
 */
export async function verifyShopifyHmac(url, secret, maxAgeSeconds = 300) {
  if (!secret) return false;

  const params = new URL(url).searchParams;
  const signature = params.get('signature');

  if (!signature) return false;

  const timestamp = parseInt(params.get('timestamp') ?? '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(timestamp) || Math.abs(now - timestamp) > maxAgeSeconds) return false;

  const message = [...params.entries()]
    .filter(([k]) => k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  try {
    return await crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature),
      encoder.encode(message)
    );
  } catch {
    return false;
  }
}
