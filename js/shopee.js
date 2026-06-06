/**
 * Shopee Livestream — import XLSX, sub-menu Dashboard & Host.
 */
import { API_BASE } from './config.js';
import { initDateRangePicker, getDateRange } from './dateRangePicker.js';

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
  { key: 'host',                label: 'Host',                 num: false, sortable: false },
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
let _hostMap     = {}; // { session_id: [host, ...] }
let _allHosts    = []; // semua host untuk dropdown assign
let _page        = 1;
let _search      = '';
let _dateRange   = 'last_30d';
let _customSince = '';
let _customUntil = '';
let _sortKey     = 'start_date';
let _sortDir     = 'desc';
let _uploading   = false;
const PAGE_SIZE  = 50;

// Sub-menu state
let _activeTab = 'dashboard'; // 'dashboard' | 'hosts'

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

// ── Host API ──────────────────────────────────────────

async function fetchHosts() { return apiGet('/hosts'); }

async function fetchSessionHostMap() { return apiGet('/session-hosts'); }

async function saveHost(host, id = null) {
  const url    = id ? `${API_BASE}/shopee/hosts/${id}` : `${API_BASE}/shopee/hosts`;
  const method = id ? 'PUT' : 'POST';
  const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(host) });
  const data   = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function deleteHostById(id) {
  const res  = await fetch(`${API_BASE}/shopee/hosts/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function assignHostToSession(sessionId, hostId) {
  const res  = await fetch(`${API_BASE}/shopee/sessions/${sessionId}/hosts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host_id: hostId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function unassignHostFromSession(sessionId, hostId) {
  const res  = await fetch(`${API_BASE}/shopee/sessions/${sessionId}/hosts/${hostId}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadSessions() {
  const { since, until } = _dateRange === 'custom'
    ? { since: _customSince, until: _customUntil }
    : getDateRange(_dateRange);
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

      <!-- Sub-menu tabs -->
      <div class="shopee-tabs">
        <button class="shopee-tab ${_activeTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">
          📊 Dashboard
        </button>
        <button class="shopee-tab ${_activeTab === 'hosts' ? 'active' : ''}" data-tab="hosts">
          👤 Host
        </button>
      </div>

      <!-- Tab content -->
      <div id="shopeeTabContent">
        ${_activeTab === 'dashboard' ? renderDashboardTab() : renderHostsTab()}
      </div>

    </div>`;
}

function renderDashboardTab() {
  return `
    <!-- Assign host modal -->
    <div class="modal-overlay" id="assignModalOverlay" style="display:none">
      <div class="modal" style="max-width:360px">
        <div class="modal-header">
          <h3>Assign Host</h3>
          <button class="btn-close-modal" id="btnCloseAssign">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Pilih host untuk sesi ini:</p>
          <div id="assignHostList" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>
      </div>
    </div>

    <!-- Table card -->
    <div class="card table-card" id="shopeeTableCard" style="display:flex">
      <div class="card-header">
        <h3>📋 Riwayat Sesi Livestream</h3>
        <div class="table-controls">
          <input type="text" id="shopeeSearch" placeholder="🔍 Cari session ID..." value="${escHtml(_search)}" />
          <label class="btn-sm btn-outline" for="xlsxFileInput" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
            📤 Import XLSX
            <input type="file" id="xlsxFileInput" accept=".xlsx,.xls" style="display:none" />
          </label>
        </div>
      </div>
      <div id="uploadStatus" style="display:none;margin:0 20px;flex-shrink:0"></div>
      <div class="table-wrapper" id="shopeeTableWrap">
        ${renderTableLoading()}
      </div>
      <div class="table-footer">
        <span id="shopeeTableInfo">—</span>
        <span id="shopeeLastUpdated" style="font-size:12px;color:var(--text-muted)">—</span>
      </div>
    </div>`;
}

function renderHostsTab(hosts = null) {
  return `
    <div class="card table-card" style="display:flex">
      <div class="card-header">
        <h3>👤 Manajemen Host</h3>
        <div class="table-controls">
          <button class="btn-primary" id="btnAddHost">+ Tambah Host</button>
        </div>
      </div>

      <!-- Add/Edit form (hidden by default) -->
      <div id="hostFormWrap" style="display:none;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div class="host-form">
          <input type="hidden" id="hostEditId" />
          <div class="form-row">
            <div class="form-group">
              <label>Nama Host <span class="required">*</span></label>
              <input type="text" id="hostName" placeholder="Nama lengkap host..." />
            </div>
            <div class="form-group">
              <label>No. HP</label>
              <input type="text" id="hostPhone" placeholder="08xxxxxxxxxx" />
            </div>
          </div>
          <div class="form-group">
            <label>Catatan</label>
            <input type="text" id="hostNotes" placeholder="Catatan opsional..." />
          </div>
          <div class="form-actions">
            <button class="btn-secondary" id="btnCancelHost">Batal</button>
            <button class="btn-primary" id="btnSaveHost">Simpan</button>
          </div>
        </div>
      </div>

      <div class="table-wrapper" id="hostsTableWrap">
        <div class="shopee-loading"><div class="spinner"></div><p>Memuat host...</p></div>
      </div>
      <div class="table-footer">
        <span id="hostsInfo">—</span>
      </div>
    </div>`;
}

function renderHostsTable(hosts) {
  if (!hosts.length) return `
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <p>Belum ada host. Tambah host pertama.</p>
    </div>`;

  return `
    <table>
      <thead><tr>
        <th>Nama</th>
        <th>No. HP</th>
        <th>Catatan</th>
        <th>Dibuat</th>
        <th style="width:100px"></th>
      </tr></thead>
      <tbody>
        ${hosts.map(h => `
          <tr>
            <td><strong>${escHtml(h.name)}</strong></td>
            <td>${h.phone ? escHtml(h.phone) : '<span style="color:var(--text-muted)">—</span>'}</td>
            <td style="color:var(--text-muted);font-size:12px">${h.notes ? escHtml(h.notes) : '—'}</td>
            <td style="font-size:11px;color:var(--text-muted)">${fmtDate(h.created_at)}</td>
            <td>
              <div style="display:flex;gap:6px;justify-content:flex-end">
                <button class="btn-sm btn-outline btn-edit-host" data-id="${h.id}" data-name="${escHtml(h.name)}" data-phone="${escHtml(h.phone||'')}" data-notes="${escHtml(h.notes||'')}">✏️</button>
                <button class="btn-sm btn-danger btn-del-host" data-id="${h.id}" data-name="${escHtml(h.name)}">🗑</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderTableLoading() {
  return `<div class="shopee-loading"><div class="spinner"></div><p>Memuat data...</p></div>`;
}

function renderTableSection() {
  const tableEl  = document.getElementById('shopeeTableWrap');
  const infoEl   = document.getElementById('shopeeTableInfo');
  const updEl    = document.getElementById('shopeeLastUpdated');
  if (!tableEl) return;

  if (!_filtered.length) {
    tableEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Tidak ada data untuk periode ini.</p></div>`;
    if (infoEl) infoEl.textContent = '0 sesi';
    return;
  }

  // Paginasi
  const start = (_page - 1) * PAGE_SIZE;
  const page  = _filtered.slice(start, start + PAGE_SIZE);

  // Header dengan sort arrows — sama dengan Meta Ads pattern
  const thead = COLS.map(c => {
    if (!c.sortable) return `<th class="${c.num ? 'num' : ''}">${c.label}</th>`;
    const active = _sortKey === c.key;
    const arrow  = active ? (_sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable${active ? ' sorted' : ''} ${c.num ? 'num' : ''}" data-col="${c.key}">${c.label}<span class="sort-arrow">${arrow || ' ↕'}</span></th>`;
  }).join('');

  // Rows
  const tbody = page.map(s => {
    const hosts  = _hostMap[s.session_id] || [];
    const badges = hosts.map(h =>
      `<span class="host-badge" data-session="${escHtml(s.session_id)}" data-hid="${h.id}" data-hname="${escHtml(h.name)}">${escHtml(h.name)} ✕</span>`
    ).join('');

    return `<tr>${COLS.map(c => {
      if (c.key === 'host') return `<td><div class="host-cell">${badges}<button class="btn-assign-host btn-sm btn-outline" data-session="${escHtml(s.session_id)}">＋</button></div></td>`;
      const v = s[c.key];
      if (c.key === 'session_id') return `<td style="font-size:11px;font-family:monospace;white-space:nowrap">${escHtml(v)}</td>`;
      if (c.key === 'start_date') return `<td style="white-space:nowrap;font-size:12px">${fmtDate(v)}</td>`;
      if (!c.num) return `<td style="white-space:nowrap">${v ?? '—'}</td>`;
      const n = parseFloat(v) || 0;
      if (IDR_COLS.has(c.key)) return `<td class="num">${n > 0 ? fmtIDR(n) : '—'}</td>`;
      return `<td class="num">${n > 0 ? fmtNum(n) : '—'}</td>`;
    }).join('')}</tr>`;
  }).join('');

  // Footer totals — pakai class foot-label dan foot-val sama dengan Meta Ads
  const totals = {};
  SUM_COLS.forEach(k => {
    totals[k] = _filtered.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  });

  const tfoot = COLS.map(c => {
    if (c.key === 'session_id') return `<td class="col-sticky foot-label">Total (${_filtered.length})</td>`;
    if (!SUM_COLS.has(c.key))   return `<td></td>`;
    const val = totals[c.key] || 0;
    if (IDR_COLS.has(c.key))    return `<td class="num foot-val">${val > 0 ? fmtIDR(val) : '—'}</td>`;
    return `<td class="num foot-val">${val > 0 ? fmtNum(val) : '—'}</td>`;
  }).join('');

  tableEl.innerHTML = `
    <table id="shopeeTable">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
      <tfoot><tr>${tfoot}</tr></tfoot>
    </table>`;

  // Sort listeners
  tableEl.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.col;
      _sortDir  = _sortKey === key ? (_sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
      _sortKey  = key;
      applyFilterSort();
    });
  });

  // Update info
  if (infoEl) infoEl.textContent = `${_filtered.length} sesi`;
  if (updEl)  updEl.textContent  = 'Diperbarui: ' + new Date().toLocaleTimeString('id-ID');
}

// ── Data loaders ──────────────────────────────────────

async function refreshAll() {
  const tableEl = document.getElementById('shopeeTableWrap');
  if (tableEl)  tableEl.innerHTML = renderTableLoading();

  try {
    // Load sessions + host map paralel
    const [result, hostMap, hosts] = await Promise.all([
      loadSessions(),
      fetchSessionHostMap().catch(() => ({})),
      fetchHosts().catch(() => []),
    ]);
    _allSessions = result.data || [];
    _hostMap     = hostMap;
    _allHosts    = hosts;
    applyFilterSort();
  } catch (err) {
    if (tableEl) tableEl.innerHTML = `<div class="shopee-error">⚠️ ${escHtml(err.message)}</div>`;
  }
}

// ── Events ────────────────────────────────────────────

export function initShopeeEvents() {
  const $ = id => document.getElementById(id);

  // ── Tab switching ─────────────────────────────────────
  document.getElementById('shopeePage')?.addEventListener('click', e => {
    const tab = e.target.closest('.shopee-tab');
    if (!tab) return;
    const newTab = tab.dataset.tab;
    if (newTab === _activeTab) return;
    _activeTab = newTab;

    // Update tab active class
    document.querySelectorAll('.shopee-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === _activeTab)
    );

    // Re-render tab content
    const content = document.getElementById('shopeeTabContent');
    if (!content) return;

    if (_activeTab === 'dashboard') {
      content.innerHTML = renderDashboardTab();
      wireDashboardEvents();
      refreshSessions();
    } else if (_activeTab === 'hosts') {
      content.innerHTML = renderHostsTab();
      wireHostEvents();
      loadHosts();
    }
  });

  // ── Init active tab ────────────────────────────────────
  if (_activeTab === 'dashboard') {
    wireDashboardEvents();
    refreshAll();
  } else {
    wireHostEvents();
    loadHosts();
  }

  // ── Date range picker — topbar ─────────────────────────
  initDateRangePicker('shopee', (since, until, range) => {
    _dateRange   = range;
    _customSince = since;
    _customUntil = until;
    _page        = 1;
    if (_activeTab === 'dashboard') refreshAll();
  });
}

// ── Dashboard events ──────────────────────────────────

function wireDashboardEvents() {
  const $ = id => document.getElementById(id);

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
      _uploading     = false;
      e.target.value = '';
    }
  });

  let searchTimer;
  $('shopeeSearch')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      _search = e.target.value.trim();
      applyFilterSort();
    }, 300);
  });

  // ── Assign / unassign host (delegated ke table wrapper) ──
  let _assignSessionId = null;

  $('shopeeTableWrap')?.addEventListener('click', async e => {
    // Klik tombol ＋ → buka modal assign
    const assignBtn = e.target.closest('.btn-assign-host');
    if (assignBtn) {
      _assignSessionId = assignBtn.dataset.session;
      openAssignModal(_assignSessionId);
      return;
    }

    // Klik badge host → unassign
    const badge = e.target.closest('.host-badge');
    if (badge) {
      const sid = badge.dataset.session;
      const hid = badge.dataset.hid;
      const hname = badge.dataset.hname;
      if (!confirm(`Hapus host "${hname}" dari sesi ini?`)) return;
      badge.style.opacity = '0.5';
      try {
        await unassignHostFromSession(sid, parseInt(hid, 10));
        // Update local map
        if (_hostMap[sid]) _hostMap[sid] = _hostMap[sid].filter(h => String(h.id) !== String(hid));
        renderTableSection();
      } catch (err) {
        alert('Gagal: ' + err.message);
        badge.style.opacity = '1';
      }
    }
  });

  // ── Assign modal events ──
  $('btnCloseAssign')?.addEventListener('click', closeAssignModal);
  $('assignModalOverlay')?.addEventListener('click', e => {
    if (e.target === $('assignModalOverlay')) closeAssignModal();
  });

  function openAssignModal(sessionId) {
    const overlay  = $('assignModalOverlay');
    const listEl   = $('assignHostList');
    if (!overlay || !listEl) return;

    const assigned = (_hostMap[sessionId] || []).map(h => h.id);

    listEl.innerHTML = _allHosts.map(h => {
      const isAssigned = assigned.includes(h.id);
      return `
        <div class="assign-host-row">
          <div>
            <strong>${escHtml(h.name)}</strong>
            ${h.phone ? `<span style="color:var(--text-muted);font-size:12px;margin-left:8px">${escHtml(h.phone)}</span>` : ''}
          </div>
          <button class="btn-sm ${isAssigned ? 'btn-danger' : 'btn-primary'} btn-toggle-host"
            data-hid="${h.id}" data-hname="${escHtml(h.name)}" data-assigned="${isAssigned}">
            ${isAssigned ? '✕ Hapus' : '＋ Assign'}
          </button>
        </div>`;
    }).join('') || '<p style="color:var(--text-muted);text-align:center">Belum ada host. Tambah host dulu di tab Host.</p>';

    overlay.style.display = 'flex';

    // Wire toggle buttons
    listEl.querySelectorAll('.btn-toggle-host').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hid      = parseInt(btn.dataset.hid, 10);
        const hname    = btn.dataset.hname;
        const assigned = btn.dataset.assigned === 'true';
        btn.disabled   = true;

        try {
          if (assigned) {
            await unassignHostFromSession(sessionId, hid);
            if (_hostMap[sessionId]) _hostMap[sessionId] = _hostMap[sessionId].filter(h => h.id !== hid);
            btn.dataset.assigned   = 'false';
            btn.className          = 'btn-sm btn-primary btn-toggle-host';
            btn.textContent        = '＋ Assign';
          } else {
            await assignHostToSession(sessionId, hid);
            if (!_hostMap[sessionId]) _hostMap[sessionId] = [];
            const host = _allHosts.find(h => h.id === hid);
            if (host && !_hostMap[sessionId].find(h => h.id === hid)) _hostMap[sessionId].push(host);
            btn.dataset.assigned   = 'true';
            btn.className          = 'btn-sm btn-danger btn-toggle-host';
            btn.textContent        = '✕ Hapus';
          }
          renderTableSection();
        } catch (err) {
          alert('Gagal: ' + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function closeAssignModal() {
    const el = $('assignModalOverlay');
    if (el) el.style.display = 'none';
    _assignSessionId = null;
  }
}

// ── Host events ───────────────────────────────────────

function wireHostEvents() {
  const $ = id => document.getElementById(id);

  // Show add form
  $('btnAddHost')?.addEventListener('click', () => {
    $('hostEditId').value  = '';
    $('hostName').value    = '';
    $('hostPhone').value   = '';
    $('hostNotes').value   = '';
    $('hostFormWrap').style.display = 'block';
    $('hostName').focus();
  });

  // Cancel form
  $('btnCancelHost')?.addEventListener('click', () => {
    $('hostFormWrap').style.display = 'none';
  });

  // Save host
  $('btnSaveHost')?.addEventListener('click', async () => {
    const id    = $('hostEditId').value;
    const name  = $('hostName').value.trim();
    const phone = $('hostPhone').value.trim();
    const notes = $('hostNotes').value.trim();

    if (!name) { alert('Nama host wajib diisi'); $('hostName').focus(); return; }

    const btn = $('btnSaveHost');
    btn.disabled    = true;
    btn.textContent = '⏳ Menyimpan...';

    try {
      await saveHost({ name, phone, notes }, id ? parseInt(id, 10) : null);
      $('hostFormWrap').style.display = 'none';
      await loadHosts();
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Simpan';
    }
  });

  // Save on Enter in inputs
  [$('hostName'), $('hostPhone'), $('hostNotes')].forEach(el => {
    el?.addEventListener('keydown', e => { if (e.key === 'Enter') $('btnSaveHost')?.click(); });
  });

  // Edit / Delete (delegated)
  $('hostsTableWrap')?.addEventListener('click', async e => {
    const editBtn = e.target.closest('.btn-edit-host');
    const delBtn  = e.target.closest('.btn-del-host');

    if (editBtn) {
      const $ = id => document.getElementById(id);
      $('hostEditId').value  = editBtn.dataset.id;
      $('hostName').value    = editBtn.dataset.name;
      $('hostPhone').value   = editBtn.dataset.phone;
      $('hostNotes').value   = editBtn.dataset.notes;
      $('hostFormWrap').style.display = 'block';
      $('hostName').focus();
    }

    if (delBtn) {
      const name = delBtn.dataset.name;
      if (!confirm(`Hapus host "${name}"?`)) return;
      try {
        await deleteHostById(parseInt(delBtn.dataset.id, 10));
        await loadHosts();
      } catch (err) {
        alert('Gagal hapus: ' + err.message);
      }
    }
  });
}

async function loadHosts() {
  const wrap = document.getElementById('hostsTableWrap');
  const info = document.getElementById('hostsInfo');
  if (!wrap) return;

  try {
    const hosts = await fetchHosts();
    wrap.innerHTML = renderHostsTable(hosts);
    if (info) info.textContent = `${hosts.length} host`;
  } catch (err) {
    wrap.innerHTML = `<div class="shopee-error">⚠️ ${escHtml(err.message)}</div>`;
  }
}

async function refreshSessions() {
  await refreshAll();
}

function showUploadStatus(type, msg) {
  const el = document.getElementById('uploadStatus');
  if (!el) return;
  el.style.display = 'block';
  el.className     = `upload-status upload-${type}`;
  el.innerHTML     = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 5000);
}
