/**
 * Entry point — boots the application.
 */
import { TokenManager }              from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { setToken, fetchFallbackToken } from './api.js';
import { LS_TOKEN }                  from './config.js';
import { renderAgentsPage, initAgentEvents } from './agents.js';
import { renderShopeePage, initShopeeEvents } from './shopee.js';

// ── Page navigation ───────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Reset topbar-right ke state default (Meta Ads) sebelum override
  const topbarRight = document.querySelector('.topbar-right');

  if (page === 'meta-ads') {
    document.getElementById('page-meta-ads').classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'Meta Ads Monitor';
    // Restore topbar-right Meta Ads (reload dari index.html original)
    topbarRight.style.display = '';
    topbarRight.innerHTML = `
      <div class="date-range-picker">
        <label>Periode:</label>
        <select id="dateRange">
          <option value="today">Hari Ini</option>
          <option value="yesterday">Kemarin</option>
          <option value="last_7d" selected>7 Hari Terakhir</option>
          <option value="last_30d">30 Hari Terakhir</option>
          <option value="this_month">Bulan Ini</option>
          <option value="last_month">Bulan Lalu</option>
        </select>
      </div>
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
    // Re-wire Meta Ads events
    initEvents();
  } else if (page === 'ai-agents') {
    const pageEl = document.getElementById('page-ai-agents');
    pageEl.innerHTML = renderAgentsPage();
    pageEl.classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'AI Agents';
    topbarRight.style.display = 'none';
    topbarRight.innerHTML = '';
    initAgentEvents();
  } else if (page === 'shopee-live') {
    const pageEl = document.getElementById('page-shopee-live');
    pageEl.innerHTML = renderShopeePage();
    pageEl.classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'Shopee Livestream';
    topbarRight.style.display = '';
    topbarRight.innerHTML = `
      <div class="date-range-picker">
        <label>Periode:</label>
        <select id="shopeeDateRange">
          <option value="today">Hari Ini</option>
          <option value="yesterday">Kemarin</option>
          <option value="last_7d">7 Hari Terakhir</option>
          <option value="last_30d" selected>30 Hari Terakhir</option>
          <option value="this_month">Bulan Ini</option>
          <option value="last_month">Bulan Lalu</option>
          <option value="all">Semua Data</option>
        </select>
      </div>
    `;
    initShopeeEvents();
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

  // Wire up Meta Ads events
  initEvents();

  // Resolve token: localStorage → backend env → kosong
  const stored = localStorage.getItem(LS_TOKEN);
  let token    = stored || '';

  if (!token) {
    try {
      token = await fetchFallbackToken();
      localStorage.setItem(LS_TOKEN, token);
    } catch {
      console.warn('Tidak ada token tersedia, user perlu input manual.');
    }
  }

  if (token) setToken(token);
  if (token) TokenManager.init(token).catch(console.warn);

  await loadDashboard();
});
