/**
 * Entry point — boots the application.
 */
import { TokenManager }          from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { FALLBACK_TOKEN }        from './config.js';
import { setToken }              from './api.js';
import { renderAgentsPage, initAgentEvents } from './agents.js';

// ── Page navigation ───────────────────────────────────

let _activePage = 'meta-ads';

function showPage(page) {
  _activePage = page;

  // Update sidebar active state
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show/hide pages
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

  // Set token
  const stored = localStorage.getItem('mam_meta_token');
  const token  = stored || FALLBACK_TOKEN;
  setToken(token);

  // Token check in background
  TokenManager.init(FALLBACK_TOKEN).catch(console.warn);

  // Load dashboard
  await loadDashboard();
});
