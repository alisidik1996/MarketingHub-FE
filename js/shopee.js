/**
 * Shopee Livestream — import XLSX, periode filter, sort, footer total.
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

function fmtDate(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return str; }
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getDatePreset(range) {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const sub   = (d, n) => { const x = new Date(d); x.setDate(x.getDate() - n); return x; };
  switch (range) {
    case 'today':      return { since: fmt(today),       until: fmt(today) };
    case 'yesterday':  return { since: fmt(sub(today,1)), until: fmt(sub(today,1)) };
    case 'last_7d':    return { since: fmt(sub(today,6)), until: fmt(today) };
    case 'last_30d':   return { since: fmt(sub(today,29)),until: fmt(today) };
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: fmt(s), until: fmt(today) };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since: fmt(s), until: fmt(e) };
    }
    default: return { since: '', until: '' };
  }
}

// ── Column definitions ────────────────────────────────

const COLS = [
  { key: 'session_id',          label: 'Session ID',           num: false, sortable: false },
  { key: 'start_date',          label: 'Start Date',           num: false, sortable: true  },
  { key: 'total_views',         label: 'Total Views',          num: true,  sortable: true  },
  { key: 'unique_viewers',      label: 'Unique Viewers',       num: true,  sortable: true  },
  { key: 'duration_str',        label: 'Live Duration',        num: false, sortable: false },
  { key: 'duration_minutes',    label: 'Duration (min)',       num: true,  sortable: true  },
  { key: 'avg_duration_str',    label: 'Avg Duration',         num: false, sortable: false },
  { key: 'avg_duration_minutes',label: 'Avg Duration (min)',   num: true,  sortable: true  },
  { key: 'new_followers',       label: 'New Followers',        num: true,  sortable: true  },
  { key: 'likes',               label: 'Likes',                num: true,  sortable: true  },
  { key: 'comments',            label: 'Comments',             num: true,  sortable: true  },
  { key: 'buyers',              label: 'Buyers',               num: true,  sortable: true  },
  { key: 'atc_units',           label: 'ATC Units',            num: true,  sortable: true  },
  { key: 'units_sold',          label: 'Units Sold',           num: true,  sortable: true  },
  { key: 'orders',              label: 'Orders',               num: true,  sortable: true  },
  { key: 'gross_sales_local',   label: 'Gross Sales (Local)',  num: true,  sortable: true  },
  { key: 'net_sales_local',     label: 'Net Sales (Local)',    num: true,  sortable: true  },
];

// Kolom yang di-sum di footer
const SUM_COLS = new Set([
  'total_views','unique_viewers','duration_minutes','avg_duration_minutes',
  'new_followers','likes','comments','buyers','atc_units','units_sold',
  'orders','gross_sales_local','net_sales_local',
]);

// Kolom IDR
const IDR_COLS = new Set(['gross_sales_local','net_sales_local']);

// ── State ─────────────────────────────────────────────

let _allSessions = [];
let _filtered    = [];
let _page        = 1;
let _search      = '';
let _dateRange   = 'last_30d';
let _sortKey     = 'start_date';
let _sortDir     = 'desc';
let _uploading   = false;
const PAGE_SIZE  = 50;

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
  const { since, until } = getDatePreset(_dateRange);
  const q = new URLSearchParams({ limit: 1000, offset: 0, search: '' });
  if (since) q.set('since', since);
  if (until) q.set('until', until);
  return apiGet(`/sessions?${q}`);
}

// ── Client-side filter + sort ─────────────────────────

function applyFilterSort() {
  let list = [..._allSessions];

  // Search client-side
  if (_search) {
    const q = _search.toLowerCase();
    list = list.filter(s =>
      (s.session_id || '').toLowerCase().includes(q) ||
      (s.livestream_name || '').toLowerCase().includes(q)
    );
  }

  // Sort
  list.sort((a, b) => {
    let va = a[_sortKey], vb = b[_sortKey];
    if (_sortKey === 'start_date') { va = new Date(va||0).getTime(); vb = new Date(vb||0).getTime(); }
    else { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
    if (va < vb) return _sortDir === 'asc' ? -1 : 1;
    if (va > vb) return _sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  _filtered = list;
  _page     = 1;
  renderTableSection();
}

// ── Renderers ─────────────────────────────────────────

export function renderShopeePage() {
  return `
    <div class="shopee-page" id="shopeePage">

      <!-- Header -->
      <div class="shopee-header">
        <div>
          <h2 class="shopee-title">🛒 Shopee Livestream</h2>
          <p class="shopee-subtitle">Import laporan dari Shopee Seller Center dan analisis performa livestream</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
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
          <label class="btn-upload-xlsx" for="xlsxFileInput">
            📤 Import XLSX
            <input type="file" id="xlsxFileInput" accept=".xlsx,.xls" style="display:none" />
          </label>
        </div>
      </div>

      <!-- Upload status -->
      <div id="uploadStatus" style="display:none"></div>

      <!-- Table -->
      <div class="shopee-table-card">
        <div class="shopee-table-header">
          <h3>📋 Riwayat Sesi Livestream</h3>
          <input type="text" id="shopeeSearch" placeholder="🔍 Cari session ID atau nama..." value="${escHtml(_search)}" />
        </div>

        <div id="shopeeTableWrap">${renderTableLoading()}</div>

        <div class="shopee-table-footer" id="shopeeTableFooter"></div>
      </div>

    </div>`;
}

function renderTableLoading() {
  return `<div class="shopee-loading"><div class="spinner"></div><p>Memuat data...</p></div>`;
}

function renderTableSection() {
  const tableEl  = document.getElementById('shopeeTableWrap');
  const footerEl = document.getElementById('shopeeTableFooter');
  if (!tableEl) return;

  if (!_filtered.length) {
    tableEl.innerHTML  = `<div class="shopee-empty"><div class="empty-icon">📭</div><p>Tidak ada data untuk periode ini.</p></div>`;
    footerEl.innerHTML = '';
    return;
  }

  // Paginasi
  const start = (_page - 1) * PAGE_SIZE;
  const page  = _filtered.slice(start, start + PAGE_SIZE);

  // Build header dengan sort arrows
  const thead = COLS.map(c => {
    if (!c.sortable) return `<th class="${c.num?'num':''}">${c.label}</th>`;
    const active = _sortKey === c.key;
    const arrow  = active ? (_sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕';
    return `<th class="sortable ${c.num?'num':''} ${active?'sorted':''}" data-col="${c.key}">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
  }).join('');

  // Build rows
  const tbody = page.map(s => `
    <tr>
      ${COLS.map(c => {
        const v = s[c.key];
        if (c.key === 'session_id') return `<td style="font-size:11px;font-family:monospace;white-space:nowrap">${escHtml(v)}</td>`;
        if (c.key === 'start_date') return `<td style="white-space:nowrap;font-size:12px">${fmtDate(v)}</td>`;
        if (!c.num) return `<td style="white-space:nowrap">${v ?? '—'}</td>`;
        if (IDR_COLS.has(c.key)) return `<td class="num">${fmtIDR(v)}</td>`;
        return `<td class="num">${fmtNum(v)}</td>`;
      }).join('')}
    </tr>`).join('');

  // Build footer totals
  const totals = {};
  SUM_COLS.forEach(k => {
    totals[k] = _filtered.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  });

  const tfoot = COLS.map(c => {
    if (c.key === 'session_id') return `<td class="foot-label">Total (${_filtered.length})</td>`;
    if (!SUM_COLS.has(c.key))   return `<td></td>`;
    if (IDR_COLS.has(c.key))    return `<td class="num foot-val">${fmtIDR(totals[c.key])}</td>`;
    if (c.key === 'duration_minutes' || c.key === 'avg_duration_minutes')
      return `<td class="num foot-val">${totals[c.key].toFixed(0)}</td>`;
    return `<td class="num foot-val">${fmtNum(totals[c.key])}</td>`;
  }).join('');

  tableEl.innerHTML = `
    <div class="shopee-table-wrapper">
      <table id="shopeeTable">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
        <tfoot><tr>${tfoot}</tr></tfoot>
      </table>
    </div>`;

  // Sort listeners
  tableEl.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      _sortDir  = _sortKey === key ? (_sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
      _sortKey  = key;
      applyFilterSort();
    });
  });

  // Pagination footer
  const total = _filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  let pages = '';
  for (let i = 1; i <= Math.min(totalPages, 7); i++) {
    pages += `<button class="page-btn ${i===_page?'active':''}" data-p="${i}">${i}</button>`;
  }
  if (totalPages > 7) pages += `<span style="padding:0 8px;color:var(--text-muted)">... ${totalPages}</span>`;

  footerEl.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted)">${total} sesi</span>
    <div class="pagination">${pages}</div>`;
}

// ── Data loaders ──────────────────────────────────────

async function refreshAll() {
  const tableEl = document.getElementById('shopeeTableWrap');
  if (tableEl)  tableEl.innerHTML = renderTableLoading();

  try {
    const result = await loadSessions();
    _allSessions = result.data || [];
    applyFilterSort();
  } catch (err) {
    if (tableEl) tableEl.innerHTML = `<div class="shopee-error">⚠️ ${escHtml(err.message)}</div>`;
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
      _uploading        = false;
      e.target.value    = '';
    }
  });

  // Date range
  $('shopeeDateRange')?.addEventListener('change', e => {
    _dateRange = e.target.value;
    _page      = 1;
    refreshAll();
  });

  // Search
  let searchTimer;
  $('shopeeSearch')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _search = e.target.value.trim();
      applyFilterSort();
    }, 300);
  });

  // Pagination (delegated to footer)
  $('shopeeTableFooter')?.addEventListener('click', e => {
    const btn = e.target.closest('.page-btn');
    if (!btn) return;
    _page = parseInt(btn.dataset.p, 10);
    renderTableSection();
  });

  // Load data awal
  refreshAll();
}

function showUploadStatus(type, msg) {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  el.style.display = 'block';
  el.className     = `upload-status upload-${type}`;
  el.innerHTML     = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 5000);
}
