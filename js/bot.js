/**
 * Bot Setting — Telegram & WhatsApp integration config.
 * Credentials disimpan di localStorage.
 */
import { API_BASE } from './config.js';

const SK = {
  TG_TOKEN:   'bot_tg_token',
  TG_CHAT_ID: 'bot_tg_chat_id',
  TG_ENABLED: 'bot_tg_enabled',
  WA_ENABLED: 'bot_wa_enabled',
  WA_NUMBER:  'bot_wa_number',
  WA_URL:     'bot_wa_url',
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(str) {
  if (!str) return '—';
  try { return new Date(str).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return str; }
}

// ── Page renderer ─────────────────────────────────────

export function renderBotPage() {
  const tgToken   = localStorage.getItem(SK.TG_TOKEN)   || '';
  const tgChatId  = localStorage.getItem(SK.TG_CHAT_ID) || '';
  const tgEnabled = localStorage.getItem(SK.TG_ENABLED) === 'true';
  const waEnabled = localStorage.getItem(SK.WA_ENABLED) === 'true';
  const waNumber  = localStorage.getItem(SK.WA_NUMBER)  || '';
  const waUrl     = localStorage.getItem(SK.WA_URL)     || '';
  const beUrl     = API_BASE.replace('/api','');

  return `
    <div class="bot-page">

      <div class="bot-page-header">
        <h2 class="bot-title">🤖 Bot Setting</h2>
        <p class="bot-subtitle">Konfigurasi Telegram Bot dan WhatsApp untuk notifikasi dan automation</p>
      </div>

      <!-- ── Telegram ── -->
      <div class="bot-card">
        <div class="bot-card-header">
          <div class="bot-icon telegram-icon">✈️</div>
          <div>
            <div class="bot-card-title">Telegram Bot</div>
            <div class="bot-card-subtitle">Terima URL Shopee Live dari host → auto extract session ID</div>
          </div>
          <label class="bot-toggle">
            <input type="checkbox" id="tgEnabled" ${tgEnabled ? 'checked' : ''} />
            <span class="bot-toggle-slider"></span>
          </label>
        </div>

        <div class="bot-card-body" id="tgBody" style="${tgEnabled ? '' : 'display:none'}">

          <div class="bot-steps">
            <div class="bot-step"><span class="step-num">1</span>
              <span>Buka <a href="https://t.me/BotFather" target="_blank" class="bot-link">@BotFather</a> → <code>/newbot</code> → copy <strong>Bot Token</strong></span>
            </div>
            <div class="bot-step"><span class="step-num">2</span>
              <span>Tambah bot ke grup/channel → kirim pesan apa saja → buka
              <code>https://api.telegram.org/bot{TOKEN}/getUpdates</code> → copy <strong>chat.id</strong></span>
            </div>
            <div class="bot-step"><span class="step-num">3</span>
              <span>Simpan config lalu klik <strong>Setup Webhook</strong> — bot langsung aktif menerima URL Shopee</span>
            </div>
            <div class="bot-step"><span class="step-num">4</span>
              <span>Tambah <strong>Username Telegram</strong> di setiap host (tab Host) agar bot bisa auto-match pengirim</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Bot Token <span class="required">*</span></label>
              <div class="input-with-toggle">
                <input type="password" id="tgToken" value="${escHtml(tgToken)}" placeholder="123456789:ABCdef..." />
                <button type="button" class="btn-eye" id="btnToggleTgToken">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label>Chat ID <span class="required">*</span></label>
              <input type="text" id="tgChatId" value="${escHtml(tgChatId)}" placeholder="-100xxxxxxxxxx" />
              <small>ID grup/channel tempat host mengirim URL</small>
            </div>
          </div>

          <div class="bot-actions">
            <button class="btn-secondary" id="btnTestTg">📨 Test Kirim Pesan</button>
            <button class="btn-secondary" id="btnSetupWebhook">🔗 Setup Webhook</button>
            <button class="btn-secondary" id="btnRemoveWebhook">🔕 Hapus Webhook</button>
            <button class="btn-primary"   id="btnSaveTg">💾 Simpan</button>
          </div>

          <div id="tgStatus" class="bot-status" style="display:none"></div>

          <div class="bot-info-box">
            <strong>Webhook URL:</strong>
            <code id="webhookUrlDisplay">${escHtml(beUrl)}/api/bot/telegram/webhook</code>
          </div>

        </div>
      </div>

      <!-- ── Session Messages Log ── -->
      <div class="bot-card" id="msgLogCard">
        <div class="bot-card-header">
          <div class="bot-icon" style="background:rgba(79,70,229,0.15)">📋</div>
          <div>
            <div class="bot-card-title">Log Session dari Bot</div>
            <div class="bot-card-subtitle">URL Shopee Live yang dikirim host melalui Telegram</div>
          </div>
          <button class="btn-sm btn-outline" id="btnRefreshMsgs">🔄 Refresh</button>
        </div>
        <div class="table-wrapper" id="msgLogWrap" style="max-height:320px">
          <div style="text-align:center;padding:40px;color:var(--text-muted)">Klik Refresh untuk load data</div>
        </div>
      </div>

      <!-- ── WhatsApp ── -->
      <div class="bot-card">
        <div class="bot-card-header">
          <div class="bot-icon wa-icon">💬</div>
          <div>
            <div class="bot-card-title">WhatsApp Bot</div>
            <div class="bot-card-subtitle">Kirim notifikasi melalui WhatsApp (butuh server dedicated)</div>
          </div>
          <label class="bot-toggle">
            <input type="checkbox" id="waEnabled" ${waEnabled ? 'checked' : ''} />
            <span class="bot-toggle-slider"></span>
          </label>
        </div>

        <div class="bot-card-body" id="waBody" style="${waEnabled ? '' : 'display:none'}">

          <div class="bot-alert warning">
            ⚠️ <strong>Perhatian:</strong> WhatsApp bot membutuhkan server dedicated (bukan Vercel) karena butuh Puppeteer dan persistent process.
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>WA Service URL</label>
              <input type="url" id="waServiceUrl" value="${escHtml(waUrl)}" placeholder="https://your-wa-service.railway.app" />
            </div>
            <div class="form-group">
              <label>Nomor Tujuan</label>
              <input type="text" id="waNumber" value="${escHtml(waNumber)}" placeholder="628xxxxxxxxxx" />
              <small>Format: 62 + nomor (tanpa +)</small>
            </div>
          </div>

          <div class="bot-actions">
            <button class="btn-secondary" id="btnCheckWa">🔍 Cek Status</button>
            <button class="btn-secondary" id="btnTestWa">📨 Test Kirim</button>
            <button class="btn-primary"   id="btnSaveWa">💾 Simpan</button>
          </div>

          <div id="waStatus" class="bot-status" style="display:none"></div>

          <div class="bot-code-section">
            <div class="bot-code-title">📦 WA Service Template (Node.js)</div>
            <pre class="bot-code"><code>// npm install whatsapp-web.js express qrcode-terminal
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode  = require('qrcode-terminal');
const express = require('express');

const app    = express();
const client = new Client({ authStrategy: new LocalAuth() });
app.use(express.json());

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('WA Ready'));

app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  try {
    await client.sendMessage(number + '@c.us', message);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/status', (_req, res) =>
  res.json({ status: client.info ? 'connected' : 'disconnected' }));

client.initialize();
app.listen(3000);</code></pre>
            <button class="btn-sm btn-outline" id="btnCopyWaCode">📋 Copy</button>
          </div>
        </div>
      </div>

    </div>`;
}

function renderMsgTable(messages) {
  if (!messages.length) return `<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada log.</p></div>`;
  return `
    <table>
      <thead><tr>
        <th>Waktu</th>
        <th>Host</th>
        <th>No HP</th>
        <th>Telegram</th>
        <th>Session ID</th>
        <th>URL</th>
      </tr></thead>
      <tbody>
        ${messages.map(m => `
          <tr>
            <td style="white-space:nowrap;font-size:12px">${fmtDate(m.received_at)}</td>
            <td><strong>${escHtml(m.host_name || m.telegram_name || '—')}</strong></td>
            <td style="font-size:12px">${m.host_phone ? escHtml(m.host_phone) : '<span style="color:var(--text-muted)">—</span>'}</td>
            <td style="font-size:12px">${m.telegram_username ? `<span style="color:var(--accent-light)">@${escHtml(m.telegram_username)}</span>` : escHtml(m.telegram_name || '—')}</td>
            <td><code style="font-size:12px">${escHtml(m.session_id || '—')}</code></td>
            <td style="font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.raw_url || '—')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Events ────────────────────────────────────────────

export function initBotEvents() {
  const $ = id => document.getElementById(id);

  // ── Telegram ──
  $('tgEnabled')?.addEventListener('change', e => {
    $('tgBody').style.display = e.target.checked ? '' : 'none';
    localStorage.setItem(SK.TG_ENABLED, e.target.checked);
  });

  $('btnToggleTgToken')?.addEventListener('click', () => {
    const inp = $('tgToken');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('btnSaveTg')?.addEventListener('click', () => {
    const token  = $('tgToken')?.value.trim();
    const chatId = $('tgChatId')?.value.trim();
    if (!token || !chatId) { showStatus('tgStatus', 'error', 'Token dan Chat ID wajib diisi'); return; }
    localStorage.setItem(SK.TG_TOKEN,   token);
    localStorage.setItem(SK.TG_CHAT_ID, chatId);
    localStorage.setItem(SK.TG_ENABLED, 'true');
    showStatus('tgStatus', 'success', '✅ Konfigurasi tersimpan');
  });

  $('btnTestTg')?.addEventListener('click', async () => {
    const token  = $('tgToken')?.value.trim();
    const chatId = $('tgChatId')?.value.trim();
    if (!token || !chatId) { showStatus('tgStatus', 'error', 'Isi Token dan Chat ID dulu'); return; }
    const btn = $('btnTestTg');
    btn.disabled = true;
    showStatus('tgStatus', 'loading', '⏳ Mengirim...');
    try {
      const res  = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: '✅ *MarketingHub Bot Test*\n\nBot aktif dan siap menerima URL Shopee Live!', parse_mode: 'Markdown' }),
      });
      const data = await res.json();
      data.ok
        ? showStatus('tgStatus', 'success', '✅ Pesan test terkirim')
        : showStatus('tgStatus', 'error', `❌ ${data.description}`);
    } catch (e) {
      showStatus('tgStatus', 'error', '❌ ' + e.message);
    } finally { btn.disabled = false; }
  });

  $('btnSetupWebhook')?.addEventListener('click', async () => {
    const token = $('tgToken')?.value.trim();
    if (!token) { showStatus('tgStatus', 'error', 'Isi Token dulu'); return; }
    const webhookUrl = `${API_BASE.replace('/api','')}/api/bot/telegram/webhook`;
    showStatus('tgStatus', 'loading', '⏳ Setting webhook...');
    try {
      const res  = await fetch(`${API_BASE}/bot/telegram/setup-webhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, webhookUrl }),
      });
      const data = await res.json();
      data.ok
        ? showStatus('tgStatus', 'success', `✅ Webhook aktif: ${webhookUrl}`)
        : showStatus('tgStatus', 'error', `❌ ${data.description || JSON.stringify(data)}`);
    } catch (e) {
      showStatus('tgStatus', 'error', '❌ ' + e.message);
    }
  });

  $('btnRemoveWebhook')?.addEventListener('click', async () => {
    const token = $('tgToken')?.value.trim();
    if (!token) { showStatus('tgStatus', 'error', 'Isi Token dulu'); return; }
    showStatus('tgStatus', 'loading', '⏳ Menghapus webhook...');
    try {
      const res  = await fetch(`${API_BASE}/bot/telegram/remove-webhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      data.ok
        ? showStatus('tgStatus', 'success', '✅ Webhook dihapus')
        : showStatus('tgStatus', 'error', `❌ ${data.description}`);
    } catch (e) {
      showStatus('tgStatus', 'error', '❌ ' + e.message);
    }
  });

  // ── Message log ──
  $('btnRefreshMsgs')?.addEventListener('click', loadMessages);

  // ── WhatsApp ──
  $('waEnabled')?.addEventListener('change', e => {
    $('waBody').style.display = e.target.checked ? '' : 'none';
    localStorage.setItem(SK.WA_ENABLED, e.target.checked);
  });

  $('btnSaveWa')?.addEventListener('click', () => {
    localStorage.setItem(SK.WA_URL,     document.getElementById('waServiceUrl')?.value.trim() || '');
    localStorage.setItem(SK.WA_NUMBER,  $('waNumber')?.value.trim() || '');
    localStorage.setItem(SK.WA_ENABLED, 'true');
    showStatus('waStatus', 'success', '✅ Konfigurasi WA tersimpan');
  });

  $('btnCheckWa')?.addEventListener('click', async () => {
    const url = document.getElementById('waServiceUrl')?.value.trim();
    if (!url) { showStatus('waStatus', 'error', 'Masukkan URL service WA'); return; }
    showStatus('waStatus', 'loading', '⏳ Mengecek...');
    try {
      const res  = await fetch(`${url}/status`);
      const data = await res.json();
      showStatus('waStatus', data.status === 'connected' ? 'success' : 'warning',
        data.status === 'connected' ? '✅ Terhubung' : '⚠️ Belum terhubung — scan QR di server');
    } catch (e) {
      showStatus('waStatus', 'error', '❌ ' + e.message);
    }
  });

  $('btnTestWa')?.addEventListener('click', async () => {
    const url    = document.getElementById('waServiceUrl')?.value.trim();
    const number = $('waNumber')?.value.trim();
    if (!url || !number) { showStatus('waStatus', 'error', 'Isi URL dan nomor'); return; }
    showStatus('waStatus', 'loading', '⏳ Mengirim...');
    try {
      const res  = await fetch(`${url}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message: '✅ MarketingHub Bot Test\n\nKoneksi WhatsApp berhasil!' }),
      });
      const data = await res.json();
      data.success
        ? showStatus('waStatus', 'success', '✅ Terkirim')
        : showStatus('waStatus', 'error', '❌ ' + (data.error || 'Gagal'));
    } catch (e) {
      showStatus('waStatus', 'error', '❌ ' + e.message);
    }
  });

  $('btnCopyWaCode')?.addEventListener('click', () => {
    const code = document.querySelector('.bot-code code')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      const btn = $('btnCopyWaCode');
      btn.textContent = '✅ Copied';
      setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
    });
  });
}

async function loadMessages() {
  const wrap = document.getElementById('msgLogWrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="text-align:center;padding:24px"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    const res  = await fetch(`${API_BASE}/bot/telegram/messages`);
    const data = await res.json();
    wrap.innerHTML = renderMsgTable(Array.isArray(data) ? data : []);
  } catch (e) {
    wrap.innerHTML = `<div class="shopee-error">⚠️ ${escHtml(e.message)}</div>`;
  }
}

function showStatus(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cls = { success:'bot-status-success', error:'bot-status-error', warning:'bot-status-warning', loading:'bot-status-loading' };
  el.style.display = 'block';
  el.className     = `bot-status ${cls[type]||''}`;
  el.innerHTML     = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── Public helpers ────────────────────────────────────

export async function sendTelegramNotif(message) {
  const token   = localStorage.getItem(SK.TG_TOKEN);
  const chatId  = localStorage.getItem(SK.TG_CHAT_ID);
  const enabled = localStorage.getItem(SK.TG_ENABLED) === 'true';
  if (!enabled || !token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

export async function sendWaNotif(message) {
  const url     = localStorage.getItem(SK.WA_URL);
  const number  = localStorage.getItem(SK.WA_NUMBER);
  const enabled = localStorage.getItem(SK.WA_ENABLED) === 'true';
  if (!enabled || !url || !number) return;
  await fetch(`${url}/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, message }),
  }).catch(() => {});
}
