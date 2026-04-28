/**
 * Wishlist PDP block — guest localStorage + logged-in App Proxy.
 *
 * Uses sessionStorage to cache the GID list across page navigations within
 * the same tab, avoiding redundant /list API calls on every PDP visit.
 * Cache is invalidated immediately on add/remove actions and written back
 * with the authoritative list from the API response.
 *
 * Click handler is attached synchronously on init so it is never missed
 * due to an in-flight auth fetch. Auth state is resolved lazily on click.
 */
(function () {
  'use strict';

  const PROXY_BASE = '/apps/wishlist';
  const STORAGE_KEY = 'rmsc_wishlist_guest';
  const SESSION_KEY = 'rmsc_wishlist_session';
  const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min

  // ── sessionStorage cache ────────────────────────────────────────────────

  function readSessionCache() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > SESSION_TTL_MS) return null;
      return Array.isArray(parsed.list) ? parsed.list : null;
    } catch {
      return null;
    }
  }

  function writeSessionCache(list) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ list, ts: Date.now() }));
    } catch {}
  }

  function clearSessionCache() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  }

  // ── Guest localStorage helpers ──────────────────────────────────────────

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
    } catch {}
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
    // Serve from sessionStorage if fresh — zero network cost
    const cached = readSessionCache();
    if (cached !== null) {
      listCache = cached;
      apiAuthenticated = true;
      fetchPromise = null;
      return listCache;
    }

    try {
      const res = await fetch(`${PROXY_BASE}/list`);
      if (res.status === 403) {
        apiAuthenticated = false;
        listCache = [];
        fetchPromise = null;
        return listCache;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      apiAuthenticated = true;
      listCache = Array.isArray(data.list) ? data.list : [];
      writeSessionCache(listCache);
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
          writeSessionCache(listCache);
        } else {
          let local = getGuestList();
          local = currentlyActive
            ? local.filter((gid) => gid !== productGid)
            : [...new Set([...local, productGid])];
          saveGuestList(local);
          listCache = local;
        }

        setButtonState(btn, !currentlyActive);

        document.dispatchEvent(
          new CustomEvent('wishlist:changed', {
            detail: { action, productGid, list: listCache, isLoggedIn: apiAuthenticated },
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

  // Keep button state in sync when the header drawer adds/removes items.
  // If the event carries the full authoritative list, adopt it directly
  // to avoid any stale-cache drift.
  document.addEventListener('wishlist:changed', (e) => {
    const { action, productGid: changedGid, list: eventList } = e?.detail ?? {};
    if (!changedGid) return;

    if (Array.isArray(eventList)) {
      listCache = eventList;
      writeSessionCache(listCache);
    } else if (listCache !== null) {
      if (action === 'add' && !listCache.includes(changedGid)) {
        listCache = [...listCache, changedGid];
      } else if (action === 'remove') {
        listCache = listCache.filter((gid) => gid !== changedGid);
      }
      writeSessionCache(listCache);
    }

    document.querySelectorAll('.wishlist-wrapper').forEach((wrapper) => {
      const btn = wrapper.querySelector('[data-wishlist-toggle]');
      if (btn && wrapper.dataset.productGid === changedGid) {
        setButtonState(btn, action === 'add');
      }
    });
  });

  // After guest→logged-in merge, clear sessionStorage so the next read
  // fetches the merged server-side list.
  document.addEventListener('wishlist:synced', (e) => {
    listCache = null;
    fetchPromise = null;
    apiAuthenticated = false;
    clearSessionCache();

    if (Array.isArray(e?.detail?.list)) {
      listCache = e.detail.list;
      apiAuthenticated = true;
      writeSessionCache(listCache);
    }

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
