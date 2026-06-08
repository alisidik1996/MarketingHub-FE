/**
 * Bot Setting — Telegram & WhatsApp integration config.
 * Credentials disimpan di localStorage (tidak dikirim ke server kita,
 * hanya digunakan untuk test koneksi langsung ke Telegram API).
 */

const BOT_STORAGE = {
  TG_TOKEN:   'bot_tg_token',
  TG_CHAT_ID: 'bot_tg_chat_id',
  TG_ENABLED: 'bot_tg_enabled',
  WA_ENABLED: 'bot_wa_enabled',
  WA_NUMBER:  'bot_wa_number',
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Page renderer ─────────────────────────────────────

export function renderBotPage() {
  const tgToken   = localStorage.getItem(BOT_STORAGE.TG_TOKEN)   || '';
  const tgChatId  = localStorage.getItem(BOT_STORAGE.TG_CHAT_ID) || '';
  const tgEnabled = localStorage.getItem(BOT_STORAGE.TG_ENABLED) === 'true';
  const waEnabled = localStorage.getItem(BOT_STORAGE.WA_ENABLED) === 'true';
  const waNumber  = localStorage.getItem(BOT_STORAGE.WA_NUMBER)  || '';

  return `
    <div class="bot-page">

      <div class="bot-page-header">
        <h2 class="bot-title">🤖 Bot Setting</h2>
        <p class="bot-subtitle">Konfigurasi integrasi Telegram Bot dan WhatsApp untuk notifikasi dan automation</p>
      </div>

      <!-- ── Telegram ── -->
      <div class="bot-card">
        <div class="bot-card-header">
          <div class="bot-icon telegram-icon">✈️</div>
          <div>
            <div class="bot-card-title">Telegram Bot</div>
            <div class="bot-card-subtitle">Kirim notifikasi & laporan melalui Telegram Bot</div>
          </div>
          <label class="bot-toggle">
            <input type="checkbox" id="tgEnabled" ${tgEnabled ? 'checked' : ''} />
            <span class="bot-toggle-slider"></span>
          </label>
        </div>

        <div class="bot-card-body" id="tgBody" style="${tgEnabled ? '' : 'display:none'}">
          <div class="bot-steps">
            <div class="bot-step">
              <span class="step-num">1</span>
              <span>Buka <a href="https://t.me/BotFather" target="_blank" class="bot-link">@BotFather</a> di Telegram → ketik <code>/newbot</code> → ikuti instruksi → copy Bot Token</span>
            </div>
            <div class="bot-step">
              <span class="step-num">2</span>
              <span>Buka bot kamu di Telegram → klik Start → lalu buka <a href="https://api.telegram.org/bot{TOKEN}/getUpdates" target="_blank" class="bot-link">getUpdates</a> untuk dapat Chat ID</span>
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
              <input type="text" id="tgChatId" value="${escHtml(tgChatId)}" placeholder="-100xxxxxxxxxx atau @username" />
              <small>Group chat ID biasanya diawali dengan -100</small>
            </div>
          </div>

          <div class="bot-actions">
            <button class="btn-secondary" id="btnTestTg">📨 Test Kirim Pesan</button>
            <button class="btn-primary"   id="btnSaveTg">💾 Simpan</button>
          </div>

          <div id="tgStatus" class="bot-status" style="display:none"></div>

          <!-- Notification settings -->
          <div class="bot-notif-section">
            <div class="bot-notif-title">📬 Notifikasi yang dikirim:</div>
            <div class="bot-notif-list">
              ${renderNotifCheckboxes('tg', [
                { key: 'daily_report',    label: 'Laporan harian Meta Ads' },
                { key: 'live_start',      label: 'Shopee Live mulai' },
                { key: 'live_end',        label: 'Shopee Live selesai' },
                { key: 'token_expiry',    label: 'Meta token akan expired' },
              ])}
            </div>
          </div>
        </div>
      </div>

      <!-- ── WhatsApp ── -->
      <div class="bot-card">
        <div class="bot-card-header">
          <div class="bot-icon wa-icon">💬</div>
          <div>
            <div class="bot-card-title">WhatsApp Bot</div>
            <div class="bot-card-subtitle">Kirim notifikasi melalui WhatsApp menggunakan whatsapp-web.js</div>
          </div>
          <label class="bot-toggle">
            <input type="checkbox" id="waEnabled" ${waEnabled ? 'checked' : ''} />
            <span class="bot-toggle-slider"></span>
          </label>
        </div>

        <div class="bot-card-body" id="waBody" style="${waEnabled ? '' : 'display:none'}">

          <div class="bot-alert warning">
            ⚠️ <strong>Perhatian:</strong> WhatsApp bot membutuhkan server dedicated (bukan Vercel).
            Deploy service WA terpisah menggunakan Railway, Render, atau VPS karena membutuhkan
            Puppeteer/Chromium dan persistent process.
          </div>

          <div class="bot-steps">
            <div class="bot-step">
              <span class="step-num">1</span>
              <span>Deploy WA service ke server dedicated — gunakan template di bawah</span>
            </div>
            <div class="bot-step">
              <span class="step-num">2</span>
              <span>Scan QR Code yang muncul di server dengan WhatsApp kamu</span>
            </div>
            <div class="bot-step">
              <span class="step-num">3</span>
              <span>Masukkan URL service dan nomor tujuan di bawah</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>WA Service URL</label>
              <input type="url" id="waServiceUrl" placeholder="https://your-wa-service.railway.app"
                value="${localStorage.getItem('bot_wa_url') || ''}" />
              <small>URL server WA yang sudah deploy</small>
            </div>
            <div class="form-group">
              <label>Nomor Tujuan</label>
              <input type="text" id="waNumber" value="${escHtml(waNumber)}" placeholder="628xxxxxxxxxx" />
              <small>Format: 62 + nomor (tanpa +)</small>
            </div>
          </div>

          <div class="bot-actions">
            <button class="btn-secondary" id="btnCheckWa">🔍 Cek Status</button>
            <button class="btn-secondary" id="btnTestWa">📨 Test Kirim Pesan</button>
            <button class="btn-primary"   id="btnSaveWa">💾 Simpan</button>
          </div>

          <div id="waStatus" class="bot-status" style="display:none"></div>

          <!-- WA Service template -->
          <div class="bot-code-section">
            <div class="bot-code-title">📦 WA Service Template (Node.js)</div>
            <pre class="bot-code"><code>// Install: npm install whatsapp-web.js express qrcode-terminal
// File: server.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app  = express();
const client = new Client({ authStrategy: new LocalAuth() });

app.use(express.json());

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('WA Ready'));

// Endpoint untuk kirim pesan
app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  try {
    await client.sendMessage(number + '@c.us', message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Status endpoint
app.get('/status', (_req, res) => {
  res.json({ status: client.info ? 'connected' : 'disconnected' });
});

client.initialize();
app.listen(3000, () => console.log('WA Service running on port 3000'));</code></pre>
            <button class="btn-sm btn-outline" id="btnCopyWaCode">📋 Copy Code</button>
          </div>

          <!-- Notification settings -->
          <div class="bot-notif-section">
            <div class="bot-notif-title">📬 Notifikasi yang dikirim:</div>
            <div class="bot-notif-list">
              ${renderNotifCheckboxes('wa', [
                { key: 'daily_report',    label: 'Laporan harian Meta Ads' },
                { key: 'live_start',      label: 'Shopee Live mulai' },
                { key: 'live_end',        label: 'Shopee Live selesai' },
                { key: 'token_expiry',    label: 'Meta token akan expired' },
              ])}
            </div>
          </div>
        </div>
      </div>

    </div>`;
}

function renderNotifCheckboxes(prefix, items) {
  return items.map(item => {
    const key   = `bot_${prefix}_notif_${item.key}`;
    const checked = localStorage.getItem(key) !== 'false';
    return `
      <label class="checkbox-item">
        <input type="checkbox" class="bot-notif-cb" data-key="${key}" ${checked ? 'checked' : ''} />
        ${escHtml(item.label)}
      </label>`;
  }).join('');
}

// ── Events ────────────────────────────────────────────

export function initBotEvents() {
  const $ = id => document.getElementById(id);

  // ── Telegram toggle ──
  $('tgEnabled')?.addEventListener('change', e => {
    $('tgBody').style.display = e.target.checked ? '' : 'none';
    localStorage.setItem(BOT_STORAGE.TG_ENABLED, e.target.checked);
  });

  // Toggle password visibility
  $('btnToggleTgToken')?.addEventListener('click', () => {
    const inp = $('tgToken');
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Save Telegram config
  $('btnSaveTg')?.addEventListener('click', () => {
    const token  = $('tgToken')?.value.trim();
    const chatId = $('tgChatId')?.value.trim();
    if (!token || !chatId) { showBotStatus('tgStatus', 'error', 'Token dan Chat ID wajib diisi'); return; }
    localStorage.setItem(BOT_STORAGE.TG_TOKEN,   token);
    localStorage.setItem(BOT_STORAGE.TG_CHAT_ID, chatId);
    localStorage.setItem(BOT_STORAGE.TG_ENABLED, 'true');
    showBotStatus('tgStatus', 'success', '✅ Konfigurasi Telegram tersimpan');
  });

  // Test Telegram
  $('btnTestTg')?.addEventListener('click', async () => {
    const token  = $('tgToken')?.value.trim();
    const chatId = $('tgChatId')?.value.trim();
    if (!token || !chatId) { showBotStatus('tgStatus', 'error', 'Isi Token dan Chat ID dulu'); return; }

    const btn = $('btnTestTg');
    btn.disabled    = true;
    btn.textContent = '⏳ Mengirim...';
    showBotStatus('tgStatus', 'loading', '⏳ Mengirim pesan test...');

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ *MarketingHub Bot Test*\n\nKoneksi Telegram berhasil! Bot siap mengirim notifikasi.',
          parse_mode: 'Markdown',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showBotStatus('tgStatus', 'success', '✅ Pesan test berhasil dikirim ke Telegram');
      } else {
        showBotStatus('tgStatus', 'error', `❌ Error: ${data.description}`);
      }
    } catch (e) {
      showBotStatus('tgStatus', 'error', '❌ Gagal: ' + e.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = '📨 Test Kirim Pesan';
    }
  });

  // ── WhatsApp toggle ──
  $('waEnabled')?.addEventListener('change', e => {
    $('waBody').style.display = e.target.checked ? '' : 'none';
    localStorage.setItem(BOT_STORAGE.WA_ENABLED, e.target.checked);
  });

  // Save WA config
  $('btnSaveWa')?.addEventListener('click', () => {
    const url    = document.getElementById('waServiceUrl')?.value.trim();
    const number = $('waNumber')?.value.trim();
    localStorage.setItem('bot_wa_url',          url    || '');
    localStorage.setItem(BOT_STORAGE.WA_NUMBER, number || '');
    localStorage.setItem(BOT_STORAGE.WA_ENABLED,'true');
    showBotStatus('waStatus', 'success', '✅ Konfigurasi WhatsApp tersimpan');
  });

  // Check WA status
  $('btnCheckWa')?.addEventListener('click', async () => {
    const url = document.getElementById('waServiceUrl')?.value.trim();
    if (!url) { showBotStatus('waStatus', 'error', 'Masukkan URL service WA dulu'); return; }
    showBotStatus('waStatus', 'loading', '⏳ Mengecek status...');
    try {
      const res  = await fetch(`${url}/status`);
      const data = await res.json();
      showBotStatus('waStatus', data.status === 'connected' ? 'success' : 'warning',
        data.status === 'connected' ? '✅ WhatsApp terhubung' : '⚠️ WhatsApp belum terhubung — scan QR di server');
    } catch (e) {
      showBotStatus('waStatus', 'error', '❌ Tidak bisa reach service: ' + e.message);
    }
  });

  // Test WA message
  $('btnTestWa')?.addEventListener('click', async () => {
    const url    = document.getElementById('waServiceUrl')?.value.trim();
    const number = $('waNumber')?.value.trim();
    if (!url || !number) { showBotStatus('waStatus', 'error', 'Isi URL service dan nomor tujuan'); return; }
    showBotStatus('waStatus', 'loading', '⏳ Mengirim...');
    try {
      const res  = await fetch(`${url}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, message: '✅ MarketingHub Bot Test\n\nKoneksi WhatsApp berhasil!' }),
      });
      const data = await res.json();
      if (data.success) showBotStatus('waStatus', 'success', '✅ Pesan test berhasil dikirim');
      else              showBotStatus('waStatus', 'error', '❌ ' + (data.error || 'Gagal'));
    } catch (e) {
      showBotStatus('waStatus', 'error', '❌ ' + e.message);
    }
  });

  // Copy WA template code
  $('btnCopyWaCode')?.addEventListener('click', () => {
    const code = document.querySelector('.bot-code code')?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      const btn = $('btnCopyWaCode');
      btn.textContent = '✅ Copied';
      setTimeout(() => { btn.textContent = '📋 Copy Code'; }, 2000);
    });
  });

  // Notification checkboxes — save on change
  document.querySelectorAll('.bot-notif-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      localStorage.setItem(cb.dataset.key, cb.checked);
    });
  });
}

function showBotStatus(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  const cls = { success: 'bot-status-success', error: 'bot-status-error', warning: 'bot-status-warning', loading: 'bot-status-loading' };
  el.style.display = 'block';
  el.className     = `bot-status ${cls[type] || ''}`;
  el.innerHTML     = msg;
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ── Public helper — send Telegram notification ────────

export async function sendTelegramNotif(message) {
  const token  = localStorage.getItem(BOT_STORAGE.TG_TOKEN);
  const chatId = localStorage.getItem(BOT_STORAGE.TG_CHAT_ID);
  const enabled= localStorage.getItem(BOT_STORAGE.TG_ENABLED) === 'true';
  if (!enabled || !token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

export async function sendWaNotif(message) {
  const url    = localStorage.getItem('bot_wa_url');
  const number = localStorage.getItem(BOT_STORAGE.WA_NUMBER);
  const enabled= localStorage.getItem(BOT_STORAGE.WA_ENABLED) === 'true';
  if (!enabled || !url || !number) return;

  await fetch(`${url}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, message }),
  }).catch(() => {});
}
