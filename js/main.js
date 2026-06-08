/**
 * Entry point — boots the application.
 */
import { TokenManager }              from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { setToken, fetchFallbackToken } from './api.js';
import { LS_TOKEN }                  from './config.js';
import { renderAgentsPage, initAgentEvents } from './agents.js';
import { renderShopeePage, initShopeeEvents } from './shopee.js';
import { renderDateRangePicker, initDateRangePicker } from './dateRangePicker.js';
import { state as metaState } from './state.js';
import { renderBotPage, initBotEvents } from './bot.js';

// ── Page navigation ───────────────────────────────────

function showPage(page) {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  const topbarLeft  = document.querySelector('.topbar-left h1');
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
      metaState.dateRange    = range;
      metaState._customSince = since;
      metaState._customUntil = until;
      loadDashboard();
    });
    initEvents();

  } else if (page === 'ai-agents') {
    const pageEl = document.getElementById('page-ai-agents');
    if (!pageEl) return;
    pageEl.innerHTML = renderAgentsPage();
    pageEl.classList.add('active');
    topbarLeft.textContent    = 'AI Agents';
    topbarRight.style.display = 'none';
    topbarRight.innerHTML     = '';
    initAgentEvents();

  } else if (page === 'bot-setting') {
    const pageEl = document.getElementById('page-bot-setting');
    if (!pageEl) return;
    pageEl.innerHTML = renderBotPage();
    pageEl.classList.add('active');
    topbarLeft.textContent    = 'Bot Setting';
    topbarRight.style.display = 'none';
    topbarRight.innerHTML     = '';
    initBotEvents();

  } else if (page === 'shopee-live') {
    const pageEl = document.getElementById('page-shopee-live');
    if (!pageEl) return;
    pageEl.innerHTML = renderShopeePage();
    pageEl.classList.add('active');
    topbarLeft.textContent    = 'Shopee Livestream';
    topbarRight.style.display = '';
    topbarRight.innerHTML     = renderDateRangePicker('shopee', 'last_30d', true);
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

  // Resolve token DULU sebelum render halaman
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

  // Boot ke halaman Meta Ads setelah token ready
  showPage('meta-ads');

  // Token inspect + auto-extend di background
  if (token) TokenManager.init(token).catch(console.warn);

  await loadDashboard();
});
