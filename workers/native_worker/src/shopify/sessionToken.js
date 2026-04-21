/**
 * Shopify session token validation (Customer Account + Admin / App Bridge).
 *
 * Session tokens are HS256 JWTs signed with the app's client secret.
 * They are obtained in:
 *   - Customer Account UI extensions:  shopify.sessionToken.get()
 *   - Admin (App Bridge) pages:        shopify.idToken()
 *
 * @see https://shopify.dev/docs/api/customer-account-ui-extensions/latest/apis/session-token
 * @see https://shopify.dev/docs/api/app-bridge-library/apis/id-token
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
 * Verify an HS256 JWT signed with the app's client secret and return
 * the decoded payload. Rejects on bad signature or expiry.
 *
 * @param {string} token  JWT
 * @param {string} secret App client secret (SHOPIFY_CLIENT_SECRET)
 * @returns {Promise<Record<string, unknown>>}
 */
async function verifyJwt(token, secret) {
  if (!token || !secret) throw new Error('Missing token or secret');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [header, payload, sig] = parts;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = base64UrlDecode(sig);
  const data = new TextEncoder().encode(`${header}.${payload}`);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
  if (!valid) throw new Error('Invalid session token signature');

  const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));

  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < now) throw new Error('Session token expired');
  if (decoded.nbf && decoded.nbf > now + 10) throw new Error('Session token not yet valid');

  return decoded;
}

/**
 * Verify a Customer Account session token and extract customer + shop claims.
 *
 * @param {string} token  JWT from shopify.sessionToken.get()
 * @param {string} secret App client secret (SHOPIFY_CLIENT_SECRET)
 * @returns {Promise<{ customerId: string; shop: string }>}
 */
export async function verifySessionToken(token, secret) {
  const decoded = await verifyJwt(token, secret);

  // sub = "gid://shopify/Customer/12345" (present when customer is logged in)
  const sub = String(decoded.sub ?? '');
  const customerMatch = sub.match(/gid:\/\/shopify\/Customer\/(\d+)/);
  if (!customerMatch) throw new Error('Session token missing customer identity');

  // dest = "store-name.myshopify.com" (no https://)
  const shop = String(decoded.dest ?? '');
  if (!shop) throw new Error('Session token missing shop destination');

  return { customerId: customerMatch[1], shop };
}

/**
 * Verify an admin App Bridge ID token and extract shop + staff user claims.
 *
 * Admin tokens carry the staff user GID in `sub` (e.g. "gid://shopify/User/123")
 * rather than a Customer GID, so we accept any non-empty sub. The `dest` claim
 * identifies the shop the page was loaded for.
 *
 * If `expectedShop` is provided, the token's `dest` must match it exactly —
 * this prevents a token from a different Shopify store being replayed against
 * this Worker.
 *
 * @param {string} token  JWT from shopify.idToken() in App Bridge
 * @param {string} secret App client secret (SHOPIFY_CLIENT_SECRET)
 * @param {string} [expectedShop] Canonical shop hostname to require
 * @returns {Promise<{ shop: string; userId: string | null }>}
 */
export async function verifyAdminToken(token, secret, expectedShop) {
  const decoded = await verifyJwt(token, secret);

  const shop = String(decoded.dest ?? '').replace(/^https?:\/\//, '').toLowerCase();
  if (!shop) throw new Error('Admin token missing shop destination');

  if (expectedShop) {
    const want = String(expectedShop).replace(/^https?:\/\//, '').toLowerCase();
    if (shop !== want) throw new Error(`Admin token shop mismatch: ${shop} ≠ ${want}`);
  }

  const sub = String(decoded.sub ?? '');
  const userMatch = sub.match(/gid:\/\/shopify\/(?:User|Customer)\/(\d+)/) ?? sub.match(/(\d+)/);
  const userId = userMatch?.[1] ?? null;

  return { shop, userId };
}
