/**
 * Entry point — boots the application.
 */
import { TokenManager } from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { setToken, fetchFallbackToken } from './api.js';
import { LS_TOKEN } from './config.js';
import { renderShopeePage, initShopeeEvents } from './shopee.js';
import { renderDateRangePicker, initDateRangePicker } from './dateRangePicker.js';
import { state as metaState } from './state.js';
import { renderIntegrationPage, initIntegrationEvents } from './integration.js';

// ── Page navigation ───────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const topbarLeft = document.querySelector('.topbar-left h1');
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarLeft || !topbarRight) return;

  if (page === 'meta-ads') {
    document.getElementById('page-meta-ads')?.classList.add('active');
    topbarLeft.textContent = 'Meta Ads Monitor';
    topbarRight.style.display = '';
    topbarRight.innerHTML = `
      ${renderDateRangePicker('meta', metaState.dateRange || 'last_7d')}
      <button class="btn-refresh" id="btnRefresh">
        <span class="refresh-icon">↻</span> Refresh
      </button>
      <div class="last-updated" id="lastUpdated">—</div>
      <div class="token-status token-check" id="tokenStatus">
        <span class="token-icon">⏳</span>
        <span class="token-text">Memeriksa token...</span>
        <button class="btn-extend-token" id="btnExtendToken">🔄 Perpanjang</button>
      </div>
    `;
    initDateRangePicker('meta', (since, until, range) => {
      metaState.dateRange = range;
      metaState._customSince = since;
      metaState._customUntil = until;
      loadDashboard();
    });
    initEvents();

  } else if (page === 'shopee-ads') {
    const pageEl = document.getElementById('page-shopee-ads');
    if (!pageEl) return;

    let shopeeAuth = {};

    try {
      shopeeAuth = JSON.parse(
        localStorage.getItem('shopee_integration_auth') || '{}'
      );
    } catch {
      shopeeAuth = {};
    }

    const isConnected =
      !!shopeeAuth?.accessToken &&
      !!shopeeAuth?.shopId;

    pageEl.innerHTML = `
      <div class="bot-page">

        <div class="account-bar" style="display:flex">
          <div class="account-info">
            <span class="account-avatar">🛍️</span>

            <div>
              <div class="account-name">
                Shopee Ads Account
              </div>

              <div class="account-id">
                ${shopeeAuth.shopId || 'Belum terhubung'} · IDR
              </div>
            </div>
          </div>

          <div class="account-spend-info">
            <div class="spend-stat">
              <span class="spend-label">Saldo</span>
              <span class="spend-val" id="shopeeAdsBalanceAmount">
                Rp 0
              </span>
            </div>
          </div>

          <div class="account-actions">
            <span class="status-dot ${isConnected ? 'active' : ''}"></span>
            <span class="status-text">
              ${isConnected ? 'Terhubung' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div class="bot-card">
          <div class="bot-card-body">
            <div id="shopeeAdsBalanceResult" class="bot-info-box">
              Mengambil saldo Shopee Ads...
            </div>
          </div>
        </div>
      </div>
    `;

    pageEl.classList.add('active');
    topbarLeft.textContent = 'Shopee Ads';
    topbarRight.style.display = 'none';
    topbarRight.innerHTML = '';

    (async () => {
      const resultEl = document.getElementById('shopeeAdsBalanceResult');
      const balanceEl = document.getElementById('shopeeAdsBalanceAmount');

      if (!resultEl) return;

      try {
        const res = await fetch(
          'https://marketing-hub-be.vercel.app/api/shopee/ads/balance'
        );

        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Gagal mengambil saldo');
        }

        const balance =
          json?.balance ||
          json?.data?.balance ||
          json?.data?.data?.balance ||
          json?.total_balance ||
          0;

        if (balanceEl) {
          balanceEl.innerHTML =
            'Rp ' + Number(balance).toLocaleString('id-ID');
        }

        resultEl.innerHTML = `
          <div><strong>Status:</strong> Connected</div>
          <div><strong>Saldo:</strong> Rp ${Number(balance).toLocaleString('id-ID')}</div>
        `;
      } catch (err) {
        resultEl.innerHTML = `
          <div class="bot-status bot-status-error">
            ${err.message || 'Terjadi kesalahan'}
          </div>
        `;
      }
    })();

  } else if (page === 'shopee-live') {
    const pageEl = document.getElementById('page-shopee-live');
    if (!pageEl) return;
    pageEl.innerHTML = renderShopeePage();
    pageEl.classList.add('active');
    topbarLeft.textContent = 'Shopee Livestream';
    topbarRight.style.display = '';
    topbarRight.innerHTML = renderDateRangePicker('shopee', 'last_30d', true);
    initShopeeEvents();

  } else if (page === 'integration') {
    const pageEl = document.getElementById('page-integration');
    if (!pageEl) return;

    pageEl.innerHTML = renderIntegrationPage();
    pageEl.classList.add('active');

    topbarLeft.textContent = 'Marketplace Integration';
    topbarRight.style.display = 'none';
    topbarRight.innerHTML = '';

    initIntegrationEvents();
  }
}

// ── Boot ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('disabled')) return;
      showPage(item.dataset.page);
    });
  });

  // Resolve token DULU sebelum render halaman
  const stored = localStorage.getItem(LS_TOKEN);
  let token = stored || '';

  if (!token) {
    try {
      token = await fetchFallbackToken();
      localStorage.setItem(LS_TOKEN, token);
    } catch {
      console.warn('Tidak ada token tersedia, user perlu input manual.');
    }
  }

  if (token) setToken(token);

  // Boot ke halaman Meta Ads setelah token ready
  showPage('meta-ads');

  // Token inspect + auto-extend di background
  if (token) TokenManager.init(token).catch(console.warn);

  await loadDashboard();
});
