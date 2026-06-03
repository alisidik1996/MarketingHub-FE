/**
 * Shopee Livestream — import laporan XLSX dan tampilkan data dari Supabase.
 */
import { API_BASE } from './config.js';

// ── Helpers ───────────────────────────────────────────

function fmtIDR(val) {
  return 'Rp\u00a0' + (parseFloat(val) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function fmtNum(val) {
  const n = parseFloat(val) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('id-ID');
}

function fmtPct(val) {
  return ((parseFloat(val) || 0) * 100).toFixed(2) + '%';
}

function fmtDate(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return str; }
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── State ─────────────────────────────────────────────

let _sessions  = [];
let _summary   = null;
let _page      = 1;
let _search    = '';
let _uploading = false;
const PAGE_SIZE = 20;

// ── API ───────────────────────────────────────────────

async function apiGet(path) {
  const res  = await fetch(`${API_BASE}/shopee${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function uploadXlsx(file) {
  const form = new FormData();
  form.append('file', file);
  const res  = await fetch(`${API_BASE}/shopee/upload`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadSessions() {
  const offset = (_page - 1) * PAGE_SIZE;
  const q = new URLSearchParams({ limit: PAGE_SIZE, offset, search: _search });
  return apiGet(`/sessions?${q}`);
}

async function loadSummary() {
  return apiGet('/summary');
}

// ── Page renderer ─────────────────────────────────────

export function renderShopeePage() {
  return `
    <div class="shopee-page" id="shopeePage">

      <!-- Header -->
      <div class="shopee-header">
        <div>
          <h2 class="shopee-title">🛒 Shopee Livestream</h2>
          <p class="shopee-subtitle">Import laporan dari Shopee Seller Center dan analisis performa livestream</p>
        </div>
        <label class="btn-upload-xlsx" for="xlsxFileInput">
          📤 Import Laporan XLSX
          <input type="file" id="xlsxFileInput" accept=".xlsx,.xls" style="display:none" />
        </label>
      </div>

      <!-- Upload progress -->
      <div id="uploadStatus" style="display:none"></div>

      <!-- Summary cards -->
      <div class="shopee-summary-grid" id="shopeeSummary">
        ${renderSummaryLoading()}
      </div>

      <!-- Sessions table -->
      <div class="shopee-table-card">
        <div class="shopee-table-header">
          <h3>📋 Riwayat Sesi Livestream</h3>
          <div class="shopee-search-row">
            <input type="text" id="shopeeSearch" placeholder="🔍 Cari nama sesi..." value="${escHtml(_search)}" />
          </div>
        </div>

        <div id="shopeeTableWrap">
          ${renderTableLoading()}
        </div>

        <div class="shopee-table-footer" id="shopeeTableFooter"></div>
      </div>

    </div>
  `;
}

function renderSummaryLoading() {
  return Array(6).fill(0).map(() => `
    <div class="shopee-metric-card">
      <div class="skeleton" style="height:16px;width:60%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:28px;width:80%"></div>
    </div>`).join('');
}

function renderTableLoading() {
  return `<div class="shopee-loading"><div class="spinner"></div><p>Memuat data...</p></div>`;
}

function renderSummaryCards(s) {
  if (!s) return '<div class="shopee-empty"><p>Belum ada data. Import laporan XLSX dulu.</p></div>';
  return `
    ${card('📺', 'Total Sesi',       s.total_sessions,         '')}
    ${card('👁', 'Total Views',       fmtNum(s.total_views),    '')}
    ${card('👥', 'Unique Viewers',    fmtNum(s.total_unique),   '')}
    ${card('📦', 'Total Orders',      fmtNum(s.total_orders),   'accent')}
    ${card('💰', 'Gross Sales',       fmtIDR(s.total_gross_local), 'accent')}
    ${card('🛒', 'Units Sold',        fmtNum(s.total_units_sold),'')}
    ${card('❤️', 'Total Likes',       fmtNum(s.total_likes),    '')}
    ${card('💬', 'Total Comments',    fmtNum(s.total_comments), '')}
    ${card('➕', 'New Followers',     fmtNum(s.total_followers),'')}
    ${card('⏱',  'Avg Durasi',       s.avg_duration_min + ' mnt', '')}
    ${card('🎯', 'Avg Orders/Sesi',   s.avg_orders,             '')}
    ${card('👀', 'Avg Views/Sesi',    fmtNum(s.avg_views),      '')}
  `;
}

function card(icon, label, value, variant) {
  return `
    <div class="shopee-metric-card ${variant}">
      <div class="shopee-metric-icon">${icon}</div>
      <div class="shopee-metric-body">
        <div class="shopee-metric-label">${label}</div>
        <div class="shopee-metric-value">${value}</div>
      </div>
    </div>`;
}

function renderTable(sessions) {
  if (!sessions.length) {
    return `<div class="shopee-empty">
      <div class="empty-icon">📭</div>
      <p>Belum ada data sesi. Import laporan XLSX untuk memulai.</p>
    </div>`;
  }

  return `
    <div class="table-wrapper">
      <table id="shopeeTable">
        <thead><tr>
          <th>Session ID</th>
          <th>Start Date</th>
          <th class="num">Total Views</th>
          <th class="num">Unique Viewers</th>
          <th class="num">Live Duration</th>
          <th class="num">Duration (min)</th>
          <th class="num">Avg Duration</th>
          <th class="num">Avg Duration (min)</th>
          <th class="num">New Followers</th>
          <th class="num">Likes</th>
          <th class="num">Comments</th>
          <th class="num">Buyers</th>
          <th class="num">ATC Units</th>
          <th class="num">Units Sold</th>
          <th class="num">Orders</th>
          <th class="num">Gross Sales (USD)</th>
          <th class="num">Gross Sales (Local)</th>
          <th class="num">Net Sales (USD)</th>
          <th class="num">Net Sales (Local)</th>
        </tr></thead>
        <tbody>
          ${sessions.map(s => `
            <tr>
              <td class="col-sticky" style="font-size:12px;font-family:monospace">${escHtml(s.session_id)}</td>
              <td style="white-space:nowrap;font-size:12px">${fmtDate(s.start_date)}</td>
              <td class="num">${fmtNum(s.total_views)}</td>
              <td class="num">${fmtNum(s.unique_viewers)}</td>
              <td class="num" style="white-space:nowrap">${s.duration_str || '—'}</td>
              <td class="num">${s.duration_minutes || '—'}</td>
              <td class="num" style="white-space:nowrap">${s.avg_duration_str || '—'}</td>
              <td class="num">${s.avg_duration_minutes || '—'}</td>
              <td class="num">${fmtNum(s.new_followers)}</td>
              <td class="num">${fmtNum(s.likes)}</td>
              <td class="num">${fmtNum(s.comments)}</td>
              <td class="num">${fmtNum(s.buyers)}</td>
              <td class="num">${fmtNum(s.atc_units)}</td>
              <td class="num">${fmtNum(s.units_sold)}</td>
              <td class="num">${fmtNum(s.orders)}</td>
              <td class="num">$${(s.gross_sales_usd || 0).toFixed(2)}</td>
              <td class="num">${fmtIDR(s.gross_sales_local)}</td>
              <td class="num">$${(s.net_sales_usd || 0).toFixed(2)}</td>
              <td class="num">${fmtIDR(s.net_sales_local)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return '';

  const pages = [];
  for (let i = 1; i <= Math.min(totalPages, 7); i++) {
    pages.push(`<button class="page-btn ${i === _page ? 'active' : ''}" data-p="${i}">${i}</button>`);
  }
  if (totalPages > 7) pages.push(`<span style="padding:0 8px;color:var(--text-muted)">... ${totalPages}</span>`);

  return `
    <span style="font-size:12px;color:var(--text-muted)">${total} sesi</span>
    <div class="pagination">${pages.join('')}</div>`;
}

// ── Data loaders ──────────────────────────────────────

async function refreshAll() {
  // Load summary dan sessions paralel
  const [sumResult, sessResult] = await Promise.allSettled([loadSummary(), loadSessions()]);

  const summaryEl = document.getElementById('shopeeSummary');
  const tableEl   = document.getElementById('shopeeTableWrap');
  const footerEl  = document.getElementById('shopeeTableFooter');

  if (summaryEl) {
    _summary = sumResult.status === 'fulfilled' ? sumResult.value : null;
    summaryEl.innerHTML = renderSummaryCards(_summary);
  }

  if (tableEl) {
    if (sessResult.status === 'fulfilled') {
      _sessions = sessResult.value.data || [];
      tableEl.innerHTML   = renderTable(_sessions);
      footerEl.innerHTML  = renderPagination(sessResult.value.count || _sessions.length);
    } else {
      tableEl.innerHTML = `<div class="shopee-error">⚠️ ${escHtml(sessResult.reason?.message)}</div>`;
    }
  }
}

// ── Events ────────────────────────────────────────────

export function initShopeeEvents() {
  const $ = id => document.getElementById(id);

  // File upload
  $('xlsxFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || _uploading) return;
    _uploading = true;
    showUploadStatus('loading', `⏳ Mengupload ${file.name}...`);
    try {
      const result = await uploadXlsx(file);
      showUploadStatus('success', `✅ ${result.message}`);
      await refreshAll();
    } catch (err) {
      showUploadStatus('error', `⚠️ Upload gagal: ${err.message}`);
    } finally {
      _uploading   = false;
      e.target.value = '';
    }
  });

  // Search
  let searchTimer;
  $('shopeeSearch')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _search = e.target.value.trim();
      _page   = 1;
      refreshAll();
    }, 400);
  });

  // Pagination (delegated)
  $('shopeeTableFooter')?.addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (!btn) return;
    _page = parseInt(btn.dataset.p, 10);
    refreshAll();
  });

  // Load data awal
  refreshAll();
}

function showUploadStatus(type, msg) {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  el.style.display = 'block';
  el.className = `upload-status upload-${type}`;
  el.innerHTML = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 5000);
}
