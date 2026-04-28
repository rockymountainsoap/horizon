/**
 * GET /admin
 *
 * Serves the embedded admin page shown when a staff user opens the app from
 * the Shopify admin. Renders inside an iframe at
 *   https://admin.shopify.com/store/<shop>/apps/<handle>
 *
 * The HTML is static; all data fetches use an App Bridge session token via
 * `shopify.idToken()` to authenticate against /admin/stats and /admin/stats.csv.
 */

/**
 * Build the admin page HTML with the client ID injected for App Bridge.
 * @param {string} clientId
 * @param {string} shop
 */
function renderHtml(clientId, shop) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="shopify-api-key" content="${clientId}" />
  <title>Rocky Wishlist ♥</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    :root {
      --bg: #f6f6f7;
      --surface: #ffffff;
      --border: #e1e3e5;
      --text: #202223;
      --text-subdued: #6d7175;
      --accent: #008060;
      --accent-fg: #ffffff;
      --critical: #d72c0d;
      --warning: #b98900;
      --radius: 8px;
      --shadow: 0 1px 0 rgba(0,0,0,0.05);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.4;
    }
    .r-admin {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .r-admin__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .r-admin__title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
    }
    .r-admin__subtitle {
      color: var(--text-subdued);
      margin: 4px 0 0;
    }
    .r-admin__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .r-btn {
      appearance: none;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      padding: 8px 14px;
      border-radius: var(--radius);
      font: inherit;
      cursor: pointer;
      transition: background 120ms ease, box-shadow 120ms ease;
    }
    .r-btn:hover:not(:disabled) { background: #fafbfb; box-shadow: var(--shadow); }
    .r-btn:disabled { opacity: 0.55; cursor: default; }
    .r-btn--primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-fg);
    }
    .r-btn--primary:hover:not(:disabled) { background: #006e52; }
    .r-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 16px;
      margin-bottom: 16px;
    }
    .r-card__title {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-subdued);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .r-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .r-kpi__value {
      font-size: 28px;
      font-weight: 600;
      margin: 6px 0 2px;
    }
    .r-kpi__label {
      color: var(--text-subdued);
      font-size: 13px;
    }
    .r-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .r-table th, .r-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    .r-table th {
      font-weight: 600;
      color: var(--text-subdued);
      background: #fafbfb;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .r-table tr:last-child td { border-bottom: none; }
    .r-product {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .r-product__image {
      width: 40px; height: 40px; border-radius: 6px; object-fit: cover;
      background: #f0f0f0; flex: 0 0 auto;
    }
    .r-product__text { min-width: 0; }
    .r-product__title {
      font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .r-product__meta { color: var(--text-subdued); font-size: 12px; }
    .r-pill {
      display: inline-block; padding: 2px 8px; border-radius: 999px;
      background: #eef2f7; color: var(--text-subdued); font-size: 12px;
    }
    .r-pill--warn { background: #fff4d8; color: var(--warning); }
    .r-pill--error { background: #fdeae6; color: var(--critical); }
    .r-banner {
      padding: 12px 14px; border-radius: var(--radius); margin-bottom: 16px;
      border: 1px solid var(--border); background: var(--surface);
    }
    .r-banner--error { border-color: #f1a9a0; background: #fdeae6; color: var(--critical); }
    .r-muted { color: var(--text-subdued); }
    .r-empty { padding: 24px; text-align: center; color: var(--text-subdued); }
    .r-skeleton {
      display: inline-block; height: 14px; width: 80px; border-radius: 4px;
      background: linear-gradient(90deg, #eee 0%, #f5f5f5 50%, #eee 100%);
      background-size: 200% 100%; animation: r-skel 1.2s infinite;
    }
    @keyframes r-skel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .r-flex-between {
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .r-link {
      display: inline-flex; align-items: center; gap: 3px;
      color: var(--accent); text-decoration: none; font-size: 12px; white-space: nowrap;
    }
    .r-link:hover { text-decoration: underline; }
    .r-pager {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 12px 0 2px;
    }
    .r-pager__info { color: var(--text-subdued); font-size: 13px; }
    .r-btn--sm { padding: 5px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <main class="r-admin">
    <header class="r-admin__header">
      <div>
        <h1 class="r-admin__title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#e04050" aria-hidden="true" style="vertical-align:middle;margin-right:7px;flex-shrink:0"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>Rocky Wishlist
        </h1>
        <p class="r-admin__subtitle">Store: <span id="shop-domain">${shop}</span></p>
      </div>
      <div class="r-admin__actions">
        <button type="button" id="btn-refresh" class="r-btn">Refresh</button>
        <button type="button" id="btn-csv" class="r-btn r-btn--primary">Export CSV</button>
      </div>
    </header>

    <div id="banner" class="r-banner" hidden></div>

    <section class="r-card">
      <h2 class="r-card__title">At a glance</h2>
      <div class="r-kpis" id="kpis">
        <div><div class="r-kpi__label">Customers with wishlists</div><div class="r-kpi__value" data-kpi="customers"><span class="r-skeleton"></span></div></div>
        <div><div class="r-kpi__label">Items saved</div><div class="r-kpi__value" data-kpi="items"><span class="r-skeleton"></span></div></div>
        <div><div class="r-kpi__label">Avg wishlist size</div><div class="r-kpi__value" data-kpi="avg"><span class="r-skeleton"></span></div></div>
        <div><div class="r-kpi__label">Last refreshed</div><div class="r-kpi__value" data-kpi="generated"><span class="r-skeleton"></span></div></div>
      </div>
    </section>

    <section class="r-card">
      <div class="r-flex-between" style="margin-bottom:12px">
        <h2 class="r-card__title" style="margin:0">Top wishlisted products</h2>
        <span class="r-muted" id="top-meta"></span>
      </div>
      <div id="top-products-container">
        <p class="r-empty">Loading…</p>
      </div>
    </section>

    <section class="r-card">
      <h2 class="r-card__title">Recent wishlist activity</h2>
      <div id="recent-container">
        <p class="r-empty">Loading…</p>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const PAGE_SIZE = 20;
      let _topProducts = [];
      let _recent = [];
      let topPage = 0;
      let recentPage = 0;

      const statsUrl = '/admin/stats';
      const csvUrl = '/admin/stats.csv';
      const banner = document.getElementById('banner');
      const btnRefresh = document.getElementById('btn-refresh');
      const btnCsv = document.getElementById('btn-csv');

      function showError(msg) {
        banner.hidden = false;
        banner.className = 'r-banner r-banner--error';
        banner.textContent = msg;
      }
      function clearError() { banner.hidden = true; banner.textContent = ''; }

      function fmtNumber(n) {
        if (n == null || Number.isNaN(n)) return '—';
        return new Intl.NumberFormat().format(n);
      }
      function fmtDate(iso) {
        if (!iso) return '—';
        try {
          const d = new Date(iso);
          return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch { return iso; }
      }
      function fmtRelative(iso) {
        if (!iso) return '';
        const d = new Date(iso).getTime();
        if (Number.isNaN(d)) return '';
        const diffSec = Math.floor((Date.now() - d) / 1000);
        if (diffSec < 60) return diffSec + 's ago';
        if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
        if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
        return Math.floor(diffSec / 86400) + 'd ago';
      }

      async function getToken() {
        if (typeof shopify === 'undefined' || typeof shopify.idToken !== 'function') {
          throw new Error('App Bridge not available. Open this page from the Shopify admin.');
        }
        return shopify.idToken();
      }

      function renderKpis(data) {
        const el = (k) => document.querySelector('[data-kpi="' + k + '"]');
        el('customers').textContent = fmtNumber(data.totals?.customers ?? 0);
        el('items').textContent = fmtNumber(data.totals?.items ?? 0);
        el('avg').textContent = (data.totals?.averageSize ?? 0).toString();
        el('generated').textContent = fmtRelative(data.generatedAt) || '—';
        el('generated').title = fmtDate(data.generatedAt);
      }

      function renderTopProducts() {
        const container = document.getElementById('top-products-container');
        const total = _topProducts.length;
        document.getElementById('top-meta').textContent = total ? total + ' products' : '';
        if (!total) {
          container.innerHTML = '<p class="r-empty">No wishlisted products yet.</p>';
          return;
        }
        const start = topPage * PAGE_SIZE;
        const pageItems = _topProducts.slice(start, start + PAGE_SIZE);
        const rows = pageItems.map((p, i) => {
          const rank = start + i + 1;
          const statusPill = p.status === 'ACTIVE'
            ? ''
            : '<span class="r-pill r-pill--warn">' + (p.status || 'unknown').toLowerCase() + '</span>';
          const handle = p.handle
            ? '<span class="r-product__meta">' + escapeHtml(p.handle) + '</span>'
            : '<span class="r-product__meta">—</span>';
          const img = p.image
            ? '<img class="r-product__image" src="' + escapeAttr(p.image) + '" alt="" />'
            : '<div class="r-product__image"></div>';
          return (
            '<tr>' +
              '<td style="width:40px">' + rank + '</td>' +
              '<td>' +
                '<div class="r-product">' + img +
                '<div class="r-product__text">' +
                  '<div class="r-product__title">' + escapeHtml(p.title) + '</div>' +
                  handle +
                '</div></div>' +
              '</td>' +
              '<td style="width:100px">' + statusPill + '</td>' +
              '<td style="width:90px;text-align:right"><strong>' + fmtNumber(p.count) + '</strong></td>' +
            '</tr>'
          );
        }).join('');
        container.innerHTML =
          '<table class="r-table">' +
            '<thead><tr><th>#</th><th>Product</th><th>Status</th><th style="text-align:right">Wishlists</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
          buildPager(topPage, total, 'top');
        container.querySelectorAll('[data-pager="top"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            topPage = +btn.dataset.page;
            renderTopProducts();
          });
        });
      }

      function renderRecent() {
        const container = document.getElementById('recent-container');
        const total = _recent.length;
        if (!total) {
          container.innerHTML = '<p class="r-empty">No recent activity.</p>';
          return;
        }
        const start = recentPage * PAGE_SIZE;
        const pageItems = _recent.slice(start, start + PAGE_SIZE);
        const body = pageItems.map((r) => {
          const label = r.name || r.email || '(anonymous)';
          const klaviyoCell = r.email
            ? '<a class="r-link" href="https://www.klaviyo.com/people?search=' +
                encodeURIComponent(r.email) +
                '" target="_blank" rel="noopener noreferrer">Klaviyo&nbsp;↗</a>'
            : '<span class="r-muted">—</span>';
          return (
            '<tr>' +
              '<td>' + escapeHtml(label) + '</td>' +
              '<td class="r-muted">' + escapeHtml(r.email || '') + '</td>' +
              '<td style="width:80px;text-align:right">' + fmtNumber(r.count) + '</td>' +
              '<td style="width:160px" title="' + escapeAttr(fmtDate(r.updatedAt)) + '">' +
                escapeHtml(fmtRelative(r.updatedAt) || '—') +
              '</td>' +
              '<td style="width:90px">' + klaviyoCell + '</td>' +
            '</tr>'
          );
        }).join('');
        container.innerHTML =
          '<table class="r-table">' +
            '<thead><tr><th>Customer</th><th>Email</th><th style="text-align:right">Items</th><th>Updated</th><th>Profile</th></tr></thead>' +
            '<tbody>' + body + '</tbody>' +
          '</table>' +
          buildPager(recentPage, total, 'recent');
        container.querySelectorAll('[data-pager="recent"]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            recentPage = +btn.dataset.page;
            renderRecent();
          });
        });
      }

      function buildPager(page, total, containerId) {
        const pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) return '';
        const prev = '<button class="r-btn r-btn--sm" data-pager="' + containerId + '" data-page="' + (page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>← Prev</button>';
        const next = '<button class="r-btn r-btn--sm" data-pager="' + containerId + '" data-page="' + (page + 1) + '"' + (page >= pages - 1 ? ' disabled' : '') + '>Next →</button>';
        return '<div class="r-pager">' + prev + '<span class="r-pager__info">Page ' + (page + 1) + ' of ' + pages + '</span>' + next + '</div>';
      }

      function escapeHtml(s) {
        return String(s ?? '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
      }

      async function loadStats({ refresh = false } = {}) {
        clearError();
        btnRefresh.disabled = true;
        btnRefresh.textContent = refresh ? 'Refreshing…' : 'Loading…';
        try {
          const token = await getToken();
          const url = refresh ? statsUrl + '?refresh=1' : statsUrl;
          const res = await fetch(url, {
            headers: { Authorization: 'Bearer ' + token },
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.reason || ('HTTP ' + res.status));
          }
          _topProducts = data.topProducts || [];
          _recent = data.recent || [];
          topPage = 0;
          recentPage = 0;
          renderKpis(data);
          renderTopProducts();
          renderRecent();
          btnRefresh.textContent = data.cached ? 'Refresh (cached)' : 'Refresh';
        } catch (err) {
          showError('Failed to load stats: ' + (err?.message || err));
          btnRefresh.textContent = 'Retry';
        } finally {
          btnRefresh.disabled = false;
        }
      }

      async function exportCsv() {
        clearError();
        btnCsv.disabled = true;
        const originalLabel = btnCsv.textContent;
        btnCsv.textContent = 'Preparing…';
        try {
          const token = await getToken();
          const res = await fetch(csvUrl, {
            headers: { Authorization: 'Bearer ' + token },
          });
          if (!res.ok) {
            const body = await res.text();
            throw new Error(body || ('HTTP ' + res.status));
          }
          const blob = await res.blob();
          const dl = document.createElement('a');
          const objectUrl = URL.createObjectURL(blob);
          const match = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') || '');
          dl.href = objectUrl;
          dl.download = match?.[1] || ('wishlists-' + new Date().toISOString().slice(0, 10) + '.csv');
          document.body.appendChild(dl);
          dl.click();
          dl.remove();
          URL.revokeObjectURL(objectUrl);
        } catch (err) {
          showError('CSV export failed: ' + (err?.message || err));
        } finally {
          btnCsv.textContent = originalLabel;
          btnCsv.disabled = false;
        }
      }

      btnRefresh.addEventListener('click', () => loadStats({ refresh: true }));
      btnCsv.addEventListener('click', exportCsv);

      // Initial load — App Bridge may not be ready synchronously on some load
      // orders, so poll briefly before fetching.
      (async function init() {
        const deadline = Date.now() + 3000;
        while (typeof shopify === 'undefined' || typeof shopify.idToken !== 'function') {
          if (Date.now() > deadline) {
            showError('App Bridge failed to load. Refresh the page inside the Shopify admin.');
            return;
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        loadStats();
      })();
    })();
  </script>
</body>
</html>`;
}

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export function handleAdminPage(request, env) {
  const clientId = String(env.SHOPIFY_CLIENT_ID ?? '').trim();
  const shop = String(env.SHOP_DOMAIN ?? env.SHOP_MYSHOPIFY_DOMAIN ?? '').trim();

  if (!clientId) {
    return new Response('Admin page misconfigured: SHOPIFY_CLIENT_ID not set.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Frame-ancestors lets the Shopify admin embed this page; X-Frame-Options
  // is deliberately omitted (it would override the CSP in older browsers).
  return new Response(renderHtml(clientId, shop), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
