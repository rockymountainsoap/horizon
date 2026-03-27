/**
 * Wishlist PDP block — guest localStorage + logged-in App Proxy.
 *
 * Click handler is attached synchronously on init so it is never missed
 * due to an in-flight auth fetch. Auth state is resolved lazily on click.
 */
(function () {
  'use strict';

  const PROXY_BASE = '/apps/wishlist';
  const STORAGE_KEY = 'rmsc_wishlist_guest';

  function getGuestList() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveGuestList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore quota / private mode */
    }
  }

  /** @type {string[] | null} Null until first completed fetch. */
  let listCache = null;
  /** @type {Promise<string[]> | null} In-flight fetch so we never duplicate. */
  let fetchPromise = null;
  /**
   * True once the /list API confirms a logged-in customer (200 response).
   * Derived from API response, not from the Liquid data-customer-logged-in
   * attribute, which can be stale in theme app extension blocks.
   */
  let apiAuthenticated = false;

  async function fetchList() {
    try {
      const res = await fetch(`${PROXY_BASE}/list`);
      if (res.status === 403) {
        apiAuthenticated = false;
        listCache = [];
        return listCache;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      apiAuthenticated = true;
      listCache = Array.isArray(data.list) ? data.list : [];
    } catch (err) {
      console.warn('[wishlist] list fetch failed:', err?.message ?? err);
      if (listCache === null) listCache = [];
    }
    fetchPromise = null;
    return listCache;
  }

  /** Returns cached list immediately; starts a single shared fetch if needed. */
  function getCachedList() {
    if (listCache !== null) return Promise.resolve(listCache);
    if (!fetchPromise) fetchPromise = fetchList();
    return fetchPromise;
  }

  function setButtonState(btn, isActive) {
    btn.setAttribute('aria-pressed', String(isActive));
    btn.classList.toggle('wishlist-btn--active', isActive);
    const label = btn.querySelector('.wishlist-btn__label');
    if (label) label.textContent = isActive ? 'Saved' : 'Save';
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.classList.toggle('wishlist-btn--loading', loading);
  }

  function initButton(wrapper) {
    const btn = /** @type {HTMLButtonElement|null} */ (wrapper.querySelector('[data-wishlist-toggle]'));
    if (!btn) return;

    // Guard against duplicate listeners when initAll() is called multiple times
    if (btn.dataset.wishlistInit) return;
    btn.dataset.wishlistInit = '1';

    const productGid = wrapper.dataset.productGid;

    // ── Click handler attached SYNCHRONOUSLY — never blocked by async init ──
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentlyActive = btn.getAttribute('aria-pressed') === 'true';
      const action = currentlyActive ? 'remove' : 'add';
      setLoading(btn, true);
      try {
        // Resolve auth state on click (no-op if already cached)
        await getCachedList();

        if (apiAuthenticated) {
          const res = await fetch(`${PROXY_BASE}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productGid }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          listCache = Array.isArray(data.list) ? data.list : listCache;
        } else {
          let local = getGuestList();
          local = currentlyActive
            ? local.filter((gid) => gid !== productGid)
            : [...new Set([...local, productGid])];
          saveGuestList(local);
        }

        setButtonState(btn, !currentlyActive);

        document.dispatchEvent(
          new CustomEvent('wishlist:changed', {
            detail: { action, productGid, isLoggedIn: apiAuthenticated },
            bubbles: true,
          })
        );
      } catch (err) {
        console.warn('[wishlist] action failed:', err?.message ?? err);
        setButtonState(btn, currentlyActive);
      } finally {
        setLoading(btn, false);
      }
    });

    // Update initial saved/unsaved appearance once auth state is known
    getCachedList().then((list) => {
      const inWishlist = apiAuthenticated
        ? list.includes(productGid)
        : getGuestList().includes(productGid);
      setButtonState(btn, inWishlist);
    });
  }

  function initAll() {
    document.querySelectorAll('.wishlist-wrapper').forEach(initButton);
  }

  // Keep button state in sync when the header drawer adds/removes items
  document.addEventListener('wishlist:changed', (e) => {
    const { action, productGid: changedGid } = e?.detail ?? {};
    if (!changedGid || listCache === null) return;

    if (action === 'add' && !listCache.includes(changedGid)) {
      listCache = [...listCache, changedGid];
    } else if (action === 'remove') {
      listCache = listCache.filter((gid) => gid !== changedGid);
    }

    document.querySelectorAll('.wishlist-wrapper').forEach((wrapper) => {
      const btn = wrapper.querySelector('[data-wishlist-toggle]');
      if (btn && wrapper.dataset.productGid === changedGid) {
        setButtonState(btn, action === 'add');
      }
    });
  });

  // After guest→logged-in merge, reset and re-init
  document.addEventListener('wishlist:synced', () => {
    listCache = null;
    fetchPromise = null;
    apiAuthenticated = false;
    // Re-init: guard flag is already set, so listeners won't duplicate;
    // just refresh the visual state for each button
    document.querySelectorAll('.wishlist-wrapper').forEach((wrapper) => {
      const btn = wrapper.querySelector('[data-wishlist-toggle]');
      if (!btn) return;
      getCachedList().then((list) => {
        const inWishlist = apiAuthenticated
          ? list.includes(wrapper.dataset.productGid)
          : getGuestList().includes(wrapper.dataset.productGid);
        setButtonState(btn, inWishlist);
      });
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', initAll);
})();
