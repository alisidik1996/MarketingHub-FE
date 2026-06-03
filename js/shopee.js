/**
 * Shopee Livestream — auth flow + session monitoring
 * Credentials disimpan di localStorage (encrypted tidak diperlukan karena
 * access_token expire 4 jam dan hanya berlaku dari browser user sendiri).
 */
import { API_BASE } from './config.js';

// ── Storage keys ──────────────────────────────────────
const SK = {
  ACCESS_TOKEN:  'shopee_access_token',
  REFRESH_TOKEN: 'shopee_refresh_token',
  USER_ID:       'shopee_user_id',
  SHOP_ID:       'shopee_shop_id',
  EXPIRE_AT:     'shopee_expire_at',
  SESSIONS:      'shopee_sessions', // history session_id yang pernah diinput
};

// ── Auth helpers ──────────────────────────────────────

export function getShopeeAuth() {
  return {
    access_token:  localStorage.getItem(SK.ACCESS_TOKEN)  || '',
    refresh_token: localStorage.getItem(SK.REFRESH_TOKEN) || '',
    user_id:       localStorage.getItem(SK.USER_ID)       || '',
    shop_id:       localStorage.getItem(SK.SHOP_ID)       || '',
    expire_at:     parseInt(localStorage.getItem(SK.EXPIRE_AT) || '0', 10),
  };
}

export function saveShopeeAuth(data) {
  localStorage.setItem(SK.ACCESS_TOKEN,  data.access_token  || '');
  localStorage.setItem(SK.REFRESH_TOKEN, data.refresh_token || '');
  localStorage.setItem(SK.USER_ID,       String(data.user_id  || ''));
  localStorage.setItem(SK.SHOP_ID,       String(data.shop_id  || ''));
  const expireAt = Date.now() + (parseInt(data.expire_in || 14400, 10) * 1000);
  localStorage.setItem(SK.EXPIRE_AT, String(expireAt));
}

export function clearShopeeAuth() {
  Object.values(SK).forEach(k => localStorage.removeItem(k));
}

export function isShopeeAuthed() {
  const { access_token, user_id, expire_at } = getShopeeAuth();
  return !!(access_token && user_id && Date.now() < expire_at);
}

export function shopeeTokenExpiresIn() {
  const { expire_at } = getShopeeAuth();
  return Math.max(0, expire_at - Date.now());
}

// ── Session history (localStorage) ───────────────────

export function getSessions() {
  try { return JSON.parse(localStorage.getItem(SK.SESSIONS) || '[]'); }
  catch { return []; }
}

function saveSession(session) {
  const sessions = getSessions();
  const exists   = sessions.find(s => s.session_id === session.session_id);
  if (!exists) {
    sessions.unshift({ ...session, added_at: new Date().toISOString() });
    localStorage.setItem(SK.SESSIONS, JSON.stringify(sessions.slice(0, 50)));
  } else {
    // Update existing
    Object.assign(exists, session);
    localStorage.setItem(SK.SESSIONS, JSON.stringify(sessions));
  }
}

function removeSession(sessionId) {
  const sessions = getSessions().filter(s => s.session_id !== sessionId);
  localStorage.setItem(SK.SESSIONS, JSON.stringify(sessions));
}

// ── API calls ─────────────────────────────────────────

function shopeeHeaders() {
  const { access_token, user_id } = getShopeeAuth();
  return {
    'Content-Type':    'application/json',
    'x-shopee-token':  access_token,
    'x-shopee-user':   user_id,
  };
}

async function shopeeGet(path) {
  const res  = await fetch(`${API_BASE}/shopee${path}`, { headers: shopeeHeaders() });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

export async function fetchAuthUrl(authType = 'seller') {
  const res  = await fetch(`${API_BASE}/shopee/auth/url?auth_type=${authType}`);
  const data = await res.json();
  return data.url;
}

export async function refreshShopeeToken() {
  const { refresh_token, user_id } = getShopeeAuth();
  const res  = await fetch(`${API_BASE}/shopee/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refresh_token, user_id }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.message || 'Refresh gagal');
  saveShopeeAuth({ ...data, user_id });
  return data;
}

export async function fetchSessionDetail(sessionId) {
  return shopeeGet(`/session/detail?session_id=${sessionId}`);
}

export async function fetchSessionMetric(sessionId) {
  return shopeeGet(`/session/metric?session_id=${sessionId}`);
}

export async function fetchSessionItemMetric(sessionId) {
  return shopeeGet(`/session/item-metric?session_id=${sessionId}`);
}

export async function fetchSessionComments(sessionId, lastCommentId = 0) {
  const extra = lastCommentId ? `&last_comment_id=${lastCommentId}` : '';
  return shopeeGet(`/session/comments?session_id=${sessionId}${extra}`);
}

export async function fetchSessionItems(sessionId) {
  return shopeeGet(`/session/items?session_id=${sessionId}`);
}

// ── Handle OAuth callback params dari URL ─────────────

export function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('shopee_auth') !== '1') return false;

  saveShopeeAuth({
    access_token:  params.get('access_token')  || '',
    refresh_token: params.get('refresh_token') || '',
    user_id:       params.get('user_id')       || '',
    shop_id:       params.get('shop_id')       || '',
    expire_in:     parseInt(params.get('expire_in') || '14400', 10),
  });

  // Bersihkan URL dari params sensitif
  const clean = window.location.pathname;
  window.history.replaceState({}, '', clean);
  return true;
}

// ── Page renderer ─────────────────────────────────────

export function renderShopeePage() {
  const authed   = isShopeeAuthed();
  const sessions = getSessions();

  if (!authed) return renderAuthPage();
  return renderDashboardPage(sessions);
}

function renderAuthPage() {
  return `
    <div class="shopee-page">
      <div class="shopee-auth-card">
        <div class="shopee-auth-icon">🛒</div>
        <h2>Shopee Livestream</h2>
        <p>Hubungkan akun Shopee kamu untuk mulai monitoring livestream.</p>

        <div class="shopee-auth-info">
          <div class="auth-info-item">
            <span class="auth-info-icon">📊</span>
            <span>Monitor sesi live yang sedang berjalan</span>
          </div>
          <div class="auth-info-item">
            <span class="auth-info-icon">📈</span>
            <span>Lihat statistik: views, likes, orders, revenue</span>
          </div>
          <div class="auth-info-item">
            <span class="auth-info-icon">🛍️</span>
            <span>Pantau performa produk selama live</span>
          </div>
          <div class="auth-info-item">
            <span class="auth-info-icon">💬</span>
            <span>Lihat komentar real-time</span>
          </div>
        </div>

        <div class="shopee-auth-actions">
          <button class="btn-shopee-auth" id="btnShopeeAuth">
            🔗 Hubungkan Akun Shopee (Seller)
          </button>
          <button class="btn-shopee-auth btn-secondary" id="btnShopeeAuthAffiliate">
            🔗 Hubungkan Akun Affiliate
          </button>
        </div>

        <p class="shopee-auth-note">
          Kamu akan diarahkan ke halaman Shopee untuk memberikan izin akses.
        </p>
      </div>
    </div>
  `;
}

function renderDashboardPage(sessions) {
  const { user_id, shop_id, expire_at } = getShopeeAuth();
  const minsLeft = Math.floor(shopeeTokenExpiresIn() / 60000);
  const expireStr = minsLeft > 60
    ? `${Math.floor(minsLeft/60)}j ${minsLeft%60}m`
    : `${minsLeft} menit`;

  return `
    <div class="shopee-page">

      <!-- Status bar -->
      <div class="shopee-status-bar">
        <div class="shopee-status-info">
          <span class="shopee-badge connected">🟢 Terhubung</span>
          <span class="shopee-meta">User ID: <strong>${user_id}</strong></span>
          ${shop_id ? `<span class="shopee-meta">Shop ID: <strong>${shop_id}</strong></span>` : ''}
          <span class="shopee-meta">Token: <strong>${expireStr}</strong> lagi</span>
        </div>
        <div class="shopee-status-actions">
          <button class="btn-sm btn-outline" id="btnRefreshShopeeToken">🔄 Refresh Token</button>
          <button class="btn-sm btn-danger"  id="btnDisconnectShopee">⛔ Disconnect</button>
        </div>
      </div>

      <!-- Input session -->
      <div class="shopee-session-input-card">
        <h3>📡 Cek Session Livestream</h3>
        <p>Masukkan Session ID untuk melihat detail dan statistik livestream.</p>
        <div class="session-input-row">
          <input type="text" id="inputSessionId" placeholder="Masukkan Session ID..." />
          <button class="btn-primary" id="btnFetchSession">Cek Session</button>
        </div>
        <div id="sessionFetchError" class="session-error" style="display:none"></div>
      </div>

      <!-- Active session panel (shown after fetch) -->
      <div id="shopeeSessionPanel" style="display:none"></div>

      <!-- Session history -->
      <div class="shopee-history-card">
        <div class="shopee-history-header">
          <h3>📋 Riwayat Session</h3>
          ${sessions.length > 0 ? `<button class="btn-sm btn-outline" id="btnClearHistory">🗑 Hapus Semua</button>` : ''}
        </div>
        <div id="shopeeHistoryList">
          ${sessions.length === 0
            ? `<div class="shopee-empty"><div class="empty-icon">📭</div><p>Belum ada riwayat session.</p></div>`
            : sessions.map(renderHistoryItem).join('')
          }
        </div>
      </div>

    </div>
  `;
}

function renderHistoryItem(s) {
  const date = s.added_at ? new Date(s.added_at).toLocaleString('id-ID') : '—';
  const statusCls = s.status === 'ONGOING' ? 'live' : s.status === 'ENDED' ? 'ended' : '';
  const statusLabel = s.status === 'ONGOING' ? '🔴 LIVE' : s.status === 'ENDED' ? '✅ Selesai' : '—';

  return `
    <div class="shopee-history-item" data-session="${s.session_id}">
      <div class="history-item-left">
        <span class="session-status-badge ${statusCls}">${statusLabel}</span>
        <div class="history-item-info">
          <div class="history-item-title">${escHtml(s.title || 'Session #' + s.session_id)}</div>
          <div class="history-item-meta">ID: ${s.session_id} · ${date}</div>
        </div>
      </div>
      <div class="history-item-actions">
        <button class="btn-sm btn-outline btn-view-session" data-id="${s.session_id}">👁 Lihat</button>
        <button class="btn-sm btn-danger btn-remove-session" data-id="${s.session_id}">✕</button>
      </div>
    </div>
  `;
}

function renderSessionPanel(detail, metric, items) {
  const d = detail?.response || {};
  const m = metric?.response || {};
  const itemList = items?.response?.item_list || [];

  const statusCls   = d.status === 'ONGOING' ? 'live' : 'ended';
  const statusLabel = d.status === 'ONGOING' ? '🔴 SEDANG LIVE' : '✅ Selesai';
  const duration    = d.end_time && d.start_time
    ? formatDuration((d.end_time - d.start_time) * 1000)
    : '—';

  return `
    <div class="shopee-session-detail">
      <!-- Session header -->
      <div class="session-detail-header">
        ${d.cover_image ? `<img class="session-cover" src="${escHtml(d.cover_image)}" alt="cover">` : '<div class="session-cover-placeholder">📹</div>'}
        <div class="session-detail-info">
          <div class="session-detail-title">${escHtml(d.title || '—')}</div>
          <span class="session-status-badge ${statusCls} lg">${statusLabel}</span>
          <div class="session-detail-meta">
            ${d.start_time ? `<span>⏰ Mulai: ${new Date(d.start_time * 1000).toLocaleString('id-ID')}</span>` : ''}
            ${d.end_time   ? `<span>🏁 Selesai: ${new Date(d.end_time * 1000).toLocaleString('id-ID')}</span>` : ''}
            ${duration !== '—' ? `<span>⏱ Durasi: ${duration}</span>` : ''}
          </div>
        </div>
        <div class="session-detail-actions">
          <button class="btn-sm btn-outline" id="btnRefreshMetric">🔄 Refresh</button>
          ${d.status === 'ONGOING' ? `<span class="auto-refresh-badge" id="autoRefreshBadge">⚡ Auto 30s</span>` : ''}
        </div>
      </div>

      <!-- Metric cards -->
      <div class="session-metrics-grid">
        ${renderMetricCard('👁', 'Total Views',    m.total_view_count   ?? '—', '')}
        ${renderMetricCard('🔥', 'Peak Viewers',  m.peak_viewer_count  ?? '—', '')}
        ${renderMetricCard('❤️', 'Likes',          m.like_count         ?? '—', '')}
        ${renderMetricCard('💬', 'Comments',       m.comment_count      ?? '—', '')}
        ${renderMetricCard('↗️', 'Shares',          m.share_count        ?? '—', '')}
        ${renderMetricCard('🛒', 'Add to Cart',    m.atc_count          ?? '—', '')}
        ${renderMetricCard('📦', 'Orders',         m.order_count        ?? '—', 'accent')}
        ${renderMetricCard('💰', 'Revenue',        m.gmv ? fmtIDR(m.gmv) : '—', 'accent')}
      </div>

      <!-- Product list -->
      ${itemList.length > 0 ? `
        <div class="session-items-card">
          <h4>🛍️ Produk dalam Sesi (${itemList.length})</h4>
          <div class="session-items-list">
            ${itemList.map(renderSessionItem).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderMetricCard(icon, label, value, variant) {
  return `
    <div class="metric-card-shopee ${variant}">
      <div class="metric-icon">${icon}</div>
      <div class="metric-body">
        <div class="metric-label">${label}</div>
        <div class="metric-value">${value}</div>
      </div>
    </div>
  `;
}

function renderSessionItem(item) {
  return `
    <div class="session-item-row">
      ${item.item_image ? `<img src="${escHtml(item.item_image)}" class="item-thumb" alt="">` : '<div class="item-thumb-placeholder">📦</div>'}
      <div class="item-row-info">
        <div class="item-row-name">${escHtml(item.item_name || 'Produk #' + item.item_id)}</div>
        <div class="item-row-id">ID: ${item.item_id}</div>
      </div>
    </div>
  `;
}

function formatDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h>0?`${h}j`:'', m>0?`${m}m`:'', `${s}d`].filter(Boolean).join(' ');
}

function fmtIDR(val) {
  return 'Rp\u00a0' + (parseFloat(val)||0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Auto refresh interval ─────────────────────────────
let _autoRefreshTimer = null;
let _activeSessionId  = null;

function stopAutoRefresh() {
  if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = null; }
}

// ── Events ────────────────────────────────────────────

export function initShopeeEvents() {
  const $ = id => document.getElementById(id);

  // Auth buttons
  $('btnShopeeAuth')?.addEventListener('click', async () => {
    const url = await fetchAuthUrl('seller').catch(e => { alert(e.message); return null; });
    if (url) window.location.href = url;
  });

  $('btnShopeeAuthAffiliate')?.addEventListener('click', async () => {
    const url = await fetchAuthUrl('user').catch(e => { alert(e.message); return null; });
    if (url) window.location.href = url;
  });

  // Disconnect
  $('btnDisconnectShopee')?.addEventListener('click', () => {
    if (confirm('Disconnect akun Shopee?')) {
      stopAutoRefresh();
      clearShopeeAuth();
      renderAndInit();
    }
  });

  // Refresh token
  $('btnRefreshShopeeToken')?.addEventListener('click', async () => {
    const btn = $('btnRefreshShopeeToken');
    btn.disabled    = true;
    btn.textContent = '⏳ Refreshing...';
    try {
      await refreshShopeeToken();
      btn.textContent = '✅ Done';
      setTimeout(() => { btn.disabled = false; btn.textContent = '🔄 Refresh Token'; }, 2000);
      renderAndInit();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '🔄 Refresh Token';
      alert('Gagal refresh: ' + e.message);
    }
  });

  // Fetch session
  $('btnFetchSession')?.addEventListener('click', () => fetchAndShowSession($('inputSessionId')?.value?.trim()));

  $('inputSessionId')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') fetchAndShowSession($('inputSessionId').value.trim());
  });

  // History actions (delegated)
  $('shopeeHistoryList')?.addEventListener('click', e => {
    const viewBtn   = e.target.closest('.btn-view-session');
    const removeBtn = e.target.closest('.btn-remove-session');
    if (viewBtn)   fetchAndShowSession(viewBtn.dataset.id);
    if (removeBtn) { removeSession(removeBtn.dataset.id); renderAndInit(); }
  });

  // Clear history
  $('btnClearHistory')?.addEventListener('click', () => {
    if (confirm('Hapus semua riwayat session?')) {
      localStorage.removeItem(SK.SESSIONS);
      renderAndInit();
    }
  });
}

async function fetchAndShowSession(sessionId) {
  const $ = id => document.getElementById(id);
  const panel = $('shopeeSessionPanel');
  const errEl = $('sessionFetchError');

  if (!sessionId) {
    if (errEl) { errEl.textContent = 'Masukkan Session ID terlebih dahulu.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  panel.style.display = 'block';
  panel.innerHTML = `<div class="shopee-loading"><div class="spinner"></div><p>Mengambil data session...</p></div>`;

  stopAutoRefresh();
  _activeSessionId = sessionId;

  try {
    const [detail, metric, items] = await Promise.all([
      fetchSessionDetail(sessionId),
      fetchSessionMetric(sessionId),
      fetchSessionItems(sessionId),
    ]);

    // Simpan ke history
    saveSession({
      session_id: sessionId,
      title:      detail?.response?.title || '',
      status:     detail?.response?.status || '',
    });

    panel.innerHTML = renderSessionPanel(detail, metric, items);

    // Auto refresh jika session masih ONGOING
    if (detail?.response?.status === 'ONGOING') {
      _autoRefreshTimer = setInterval(() => fetchAndShowSession(sessionId), 30_000);
    }

    // Refresh button inside panel
    document.getElementById('btnRefreshMetric')?.addEventListener('click', () => {
      stopAutoRefresh();
      fetchAndShowSession(sessionId);
    });

    // Update history list
    const histEl = document.getElementById('shopeeHistoryList');
    if (histEl) histEl.innerHTML = getSessions().map(renderHistoryItem).join('') ||
      `<div class="shopee-empty"><div class="empty-icon">📭</div><p>Belum ada riwayat session.</p></div>`;

  } catch (e) {
    panel.innerHTML = `<div class="shopee-error"><span>⚠️</span><p>${escHtml(e.message)}</p></div>`;
  }
}

// Re-render and re-init (after disconnect / auth)
function renderAndInit() {
  const pageEl = document.getElementById('page-shopee-live');
  if (!pageEl) return;
  pageEl.innerHTML = renderShopeePage();
  initShopeeEvents();
}
