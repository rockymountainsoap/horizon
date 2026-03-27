/**
 * Shopify Customer Account session token validation.
 *
 * Session tokens are HS256 JWTs signed with the app's client secret.
 * They are obtained in extensions via: shopify.sessionToken.get()
 *
 * @see https://shopify.dev/docs/api/customer-account-ui-extensions/latest/apis/session-token
 */

/**
 * Decode a base64url string to a Uint8Array.
 * @param {string} str
 * @returns {Uint8Array}
 */
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Verify a Shopify Customer Account session token and extract claims.
 *
 * @param {string} token  JWT from shopify.sessionToken.get()
 * @param {string} secret App client secret (SHOPIFY_CLIENT_SECRET)
 * @returns {Promise<{ customerId: string; shop: string }>}
 * @throws {Error} If the token is invalid, expired, or missing required claims
 */
export async function verifySessionToken(token, secret) {
  if (!token || !secret) throw new Error('Missing token or secret');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [header, payload, sig] = parts;

  // Import the app secret as an HMAC-SHA256 key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Verify the signature over "header.payload"
  const sigBytes = base64UrlDecode(sig);
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) throw new Error('Invalid session token signature');

  // Decode the payload
  const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));

  // Reject expired tokens
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) throw new Error('Session token expired');

  // sub = "gid://shopify/Customer/12345" (present when customer is logged in)
  const sub = decoded.sub ?? '';
  const customerMatch = sub.match(/gid:\/\/shopify\/Customer\/(\d+)/);
  if (!customerMatch) throw new Error('Session token missing customer identity');

  // dest = "store-name.myshopify.com" (no https://)
  const shop = decoded.dest ?? '';
  if (!shop) throw new Error('Session token missing shop destination');

  return { customerId: customerMatch[1], shop };
}
