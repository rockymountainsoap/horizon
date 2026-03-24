/**
 * Wishlist PDP block — guest localStorage + logged-in App Proxy.
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
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  let listCache = null;

  async function getCachedList() {
    if (listCache !== null) return listCache;
    try {
      const res = await fetch(`${PROXY_BASE}/list`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      listCache = Array.isArray(data.list) ? data.list : [];
    } catch {
      listCache = [];
    }
    return listCache;
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

  async function initButton(wrapper) {
    const btn = wrapper.querySelector('[data-wishlist-toggle]');
    if (!btn) return;

    const productGid = wrapper.dataset.productGid;
    const isLoggedIn = wrapper.dataset.customerLoggedIn === 'true';

    let inWishlist = false;
    try {
      if (isLoggedIn) {
        const list = await getCachedList();
        inWishlist = list.includes(productGid);
      } else {
        inWishlist = getGuestList().includes(productGid);
      }
    } catch {
      inWishlist = false;
    }
    setButtonState(btn, inWishlist);

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentlyActive = btn.getAttribute('aria-pressed') === 'true';
      const action = currentlyActive ? 'remove' : 'add';

      setLoading(btn, true);
      try {
        if (isLoggedIn) {
          const res = await fetch(`${PROXY_BASE}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productGid }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          listCache = data.list;
        } else {
          let list = getGuestList();
          list = currentlyActive
            ? list.filter((gid) => gid !== productGid)
            : [...new Set([...list, productGid])];
          saveGuestList(list);
        }

        setButtonState(btn, !currentlyActive);

        document.dispatchEvent(
          new CustomEvent('wishlist:changed', {
            detail: { action, productGid, isLoggedIn },
            bubbles: true,
          })
        );
      } catch {
        setButtonState(btn, currentlyActive);
      } finally {
        setLoading(btn, false);
      }
    });
  }

  function initAll() {
    document.querySelectorAll('.wishlist-wrapper').forEach(initButton);
  }

  document.addEventListener('wishlist:synced', () => {
    listCache = null;
    initAll();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  document.addEventListener('shopify:section:load', initAll);
})();
