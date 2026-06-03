/**
 * Entry point — boots the application.
 */
import { TokenManager }              from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { setToken, fetchFallbackToken } from './api.js';
import { LS_TOKEN }                  from './config.js';
import { renderAgentsPage, initAgentEvents } from './agents.js';
import { renderShopeePage, initShopeeEvents, handleAuthCallback } from './shopee.js';

// ── Page navigation ───────────────────────────────────

let _activePage = 'meta-ads';

function showPage(page) {
  _activePage = page;

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (page === 'meta-ads') {
    document.getElementById('page-meta-ads').classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'Meta Ads Monitor';
    document.querySelector('.topbar-right').style.display = '';
  } else if (page === 'ai-agents') {
    const pageEl = document.getElementById('page-ai-agents');
    pageEl.innerHTML = renderAgentsPage();
    pageEl.classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'AI Agents';
    document.querySelector('.topbar-right').style.display = 'none';
    initAgentEvents();
  } else if (page === 'shopee-live') {
    const pageEl = document.getElementById('page-shopee-live');
    pageEl.innerHTML = renderShopeePage();
    pageEl.classList.add('active');
    document.querySelector('.topbar-left h1').textContent = 'Shopee Livestream';
    document.querySelector('.topbar-right').style.display = 'none';
    initShopeeEvents();
  }
}

// ── Boot ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Handle Shopee OAuth callback redirect (params di URL)
  const callbackResult = handleAuthCallback();
  console.log('[Shopee] handleAuthCallback result:', callbackResult);
  console.log('[Shopee] localStorage after callback:', {
    access_token: localStorage.getItem('shopee_access_token')?.slice(0,20) + '...',
    shop_id:      localStorage.getItem('shopee_shop_id'),
    expire_at:    localStorage.getItem('shopee_expire_at'),
  });
  if (callbackResult) {
    showPage('shopee-live');
  }

  // Handle Shopee auth error dari redirect
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('shopee_auth_error')) {
    const errMsg = urlParams.get('shopee_auth_error');
    window.history.replaceState({}, '', window.location.pathname);
    showPage('shopee-live');
    setTimeout(() => {
      const errEl = document.getElementById('shopeeAuthError');
      if (errEl) { errEl.textContent = 'Auth gagal: ' + errMsg; errEl.style.display = 'block'; }
    }, 100);
  }

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
      // Simpan ke localStorage agar tidak fetch ulang setiap refresh
      localStorage.setItem(LS_TOKEN, token);
    } catch {
      // Backend tidak punya fallback token — user harus input manual
      console.warn('Tidak ada token tersedia, user perlu input manual.');
    }
  }

  if (token) setToken(token);

  // Token inspect + auto-extend di background
  if (token) TokenManager.init(token).catch(console.warn);

  // Load dashboard
  await loadDashboard();
});
