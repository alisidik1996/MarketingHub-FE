/**
 * Date Range Picker — reusable component.
 * Render dropdown periode + custom date inputs.
 * Supports both Meta Ads and Shopee Livestream.
 *
 * Usage:
 *   renderDateRangePicker('metaDateRange', 'last_7d')
 *   initDateRangePicker('metaDateRange', (since, until, range) => { ... })
 */

const TODAY = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

export function getDateRange(range, customSince = '', customUntil = '') {
  if (range === 'custom') {
    return { since: customSince, until: customUntil };
  }
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const sub   = (d, n) => { const x = new Date(d); x.setDate(x.getDate() - n); return x; };
  switch (range) {
    case 'today':      return { since: fmt(today), until: fmt(today) };
    case 'yesterday':  return { since: fmt(sub(today,1)), until: fmt(sub(today,1)) };
    case 'last_7d':    return { since: fmt(sub(today,6)), until: fmt(today) };
    case 'last_30d':   return { since: fmt(sub(today,29)), until: fmt(today) };
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: fmt(s), until: fmt(today) };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth()-1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since: fmt(s), until: fmt(e) };
    }
    case 'all': return { since: '', until: '' };
    default:    return { since: fmt(sub(today,6)), until: fmt(today) };
  }
}

/**
 * Render the date range picker HTML.
 * @param {string} id - unique prefix for element IDs
 * @param {string} selected - selected preset value
 * @param {boolean} showAll - show "Semua Data" option (for Shopee)
 */
export function renderDateRangePicker(id, selected = 'last_7d', showAll = false) {
  return `
    <div class="date-range-picker drp-wrap" id="drp-${id}">
      <label>Periode:</label>
      <select id="drp-select-${id}">
        <option value="today"      ${selected==='today'      ?'selected':''}>Hari Ini</option>
        <option value="yesterday"  ${selected==='yesterday'  ?'selected':''}>Kemarin</option>
        <option value="last_7d"    ${selected==='last_7d'    ?'selected':''}>7 Hari Terakhir</option>
        <option value="last_30d"   ${selected==='last_30d'   ?'selected':''}>30 Hari Terakhir</option>
        <option value="this_month" ${selected==='this_month' ?'selected':''}>Bulan Ini</option>
        <option value="last_month" ${selected==='last_month' ?'selected':''}>Bulan Lalu</option>
        ${showAll ? `<option value="all" ${selected==='all'?'selected':''}>Semua Data</option>` : ''}
        <option value="custom"     ${selected==='custom'     ?'selected':''}>Custom...</option>
      </select>
      <div class="drp-custom" id="drp-custom-${id}" style="${selected==='custom'?'display:flex':'display:none'}">
        <input type="date" id="drp-since-${id}" value="" max="${TODAY()}" />
        <span style="color:var(--text-muted);padding:0 4px">—</span>
        <input type="date" id="drp-until-${id}" value="" max="${TODAY()}" />
        <button class="btn-sm btn-primary" id="drp-apply-${id}">Terapkan</button>
      </div>
    </div>`;
}

/**
 * Init event listeners for the date range picker.
 * @param {string} id - same prefix used in renderDateRangePicker
 * @param {function} onChange - callback(since, until, range)
 */
export function initDateRangePicker(id, onChange) {
  const select  = document.getElementById(`drp-select-${id}`);
  const custom  = document.getElementById(`drp-custom-${id}`);
  const sinceEl = document.getElementById(`drp-since-${id}`);
  const untilEl = document.getElementById(`drp-until-${id}`);
  const applyEl = document.getElementById(`drp-apply-${id}`);

  if (!select) return;

  select.addEventListener('change', () => {
    const val = select.value;
    if (val === 'custom') {
      custom.style.display = 'flex';
      // Pre-fill dengan range sebelumnya
      if (!sinceEl.value) sinceEl.value = getDateRange('last_7d').since;
      if (!untilEl.value) untilEl.value = TODAY();
    } else {
      custom.style.display = 'none';
      const { since, until } = getDateRange(val);
      onChange(since, until, val);
    }
  });

  applyEl?.addEventListener('click', () => {
    const since = sinceEl.value;
    const until = untilEl.value;
    if (!since || !until) { alert('Pilih tanggal mulai dan akhir'); return; }
    if (since > until)    { alert('Tanggal mulai tidak boleh setelah tanggal akhir'); return; }
    onChange(since, until, 'custom');
  });

  // Enter on date input triggers apply
  [sinceEl, untilEl].forEach(el => {
    el?.addEventListener('keydown', e => { if (e.key === 'Enter') applyEl?.click(); });
  });
}
