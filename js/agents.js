/**
 * AI Agents — create, manage, and run agents.
 * Agents are stored in localStorage.
 */
import { state } from './state.js';

const STORAGE_KEY = 'mam_ai_agents';

// ── Agent data helpers ────────────────────────────────

export function getAgents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveAgents(agents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

function genId() {
  return 'agent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

export function createAgent(data) {
  const agents = getAgents();
  const agent  = {
    id:          genId(),
    name:        data.name.trim(),
    description: data.description?.trim() || '',
    model:       data.model || 'gpt-4o-mini',
    apiBase:     data.apiBase?.trim() || 'https://api.openai.com/v1',
    apiKey:      data.apiKey?.trim() || '',
    systemPrompt: data.systemPrompt?.trim() || defaultSystemPrompt(),
    dataAccess:  data.dataAccess || ['campaigns', 'insights'],
    createdAt:   new Date().toISOString(),
    lastRunAt:   null,
    status:      'idle',
  };
  agents.push(agent);
  saveAgents(agents);
  return agent;
}

export function updateAgent(id, data) {
  const agents = getAgents();
  const idx    = agents.findIndex(a => a.id === id);
  if (idx === -1) return null;
  agents[idx] = { ...agents[idx], ...data };
  saveAgents(agents);
  return agents[idx];
}

export function deleteAgent(id) {
  const agents = getAgents().filter(a => a.id !== id);
  saveAgents(agents);
}

function defaultSystemPrompt() {
  return `Kamu adalah AI analyst untuk Meta Ads Dashboard MarketingHub.
Tugasmu: menganalisis performa kampanye iklan Meta dan memberikan insight yang actionable.
Jawab dalam Bahasa Indonesia. Fokus pada data yang diberikan.
Jangan berasumsi data yang tidak ada. Berikan rekomendasi yang konkret dan spesifik.`;
}

// ── Context builder ───────────────────────────────────

function buildContext(dataAccess) {
  const ctx = {};

  if (dataAccess.includes('account')) {
    ctx.account = {
      name:     state.accountName,
      id:       state.accountId,
      currency: state.accountCurrency,
      adGroup:  state.activeAdGroup,
      dateRange: state.dateRange,
    };
  }

  if (dataAccess.includes('campaigns')) {
    ctx.campaigns = state.campaigns.map(c => ({
      id:     c.id,
      name:   c.name,
      status: c.status,
    }));
  }

  if (dataAccess.includes('insights')) {
    ctx.insights = state.filteredCampaigns.map(c => ({
      name:        c.name,
      status:      c.status,
      spend:       c.spend,
      impressions: c.impressions,
      reach:       c.reach,
      clicks:      c.clicks,
      ctr:         c.ctr,
      cpm:         c.cpm,
      cpc:         c.cpc,
      ...(state.activeAdGroup === 'CPAS Ads' ? {
        cpas_purchase:       c.cpas_purchase,
        cpas_purchase_value: c.cpas_purchase_value,
        cpas_roas:           c.cpas_roas,
      } : {}),
    }));

    // Totals
    const total = ctx.insights.reduce((acc, c) => {
      acc.spend       += c.spend       || 0;
      acc.impressions += c.impressions || 0;
      acc.clicks      += c.clicks      || 0;
      acc.reach       += c.reach       || 0;
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, reach: 0 });

    ctx.summary = {
      totalCampaigns: ctx.insights.length,
      activeCampaigns: ctx.insights.filter(c => c.status === 'ACTIVE').length,
      totalSpend:   total.spend,
      totalImpresi: total.impressions,
      totalKlik:    total.clicks,
      totalJangkauan: total.reach,
      avgCTR:       total.impressions > 0 ? (total.clicks / total.impressions * 100).toFixed(2) : 0,
      avgCPM:       total.impressions > 0 ? (total.spend / total.impressions * 1000).toFixed(2) : 0,
    };
  }

  return ctx;
}

// ── Chat with agent ───────────────────────────────────

export async function chatWithAgent(agent, messages) {
  const context = buildContext(agent.dataAccess);

  const systemMessage = {
    role: 'system',
    content: agent.systemPrompt + '\n\n### DATA SAAT INI:\n' + JSON.stringify(context, null, 2),
  };

  const payload = {
    model:    agent.model,
    messages: [systemMessage, ...messages],
    temperature: 0.7,
    max_tokens:  1500,
  };

  const res = await fetch(`${agent.apiBase}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${agent.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }

  // Update last run
  updateAgent(agent.id, { lastRunAt: new Date().toISOString(), status: 'idle' });

  return data.choices?.[0]?.message?.content || '(tidak ada respons)';
}

// ── Page renderer ─────────────────────────────────────

export function renderAgentsPage() {
  const agents = getAgents();

  return `
    <div class="agents-page">
      <!-- Header -->
      <div class="agents-header">
        <div>
          <h2 class="agents-title">🤖 AI Agents</h2>
          <p class="agents-subtitle">Buat dan kelola AI analyst untuk data kampanye kamu</p>
        </div>
        <button class="btn-primary" id="btnCreateAgent">+ Buat Agent Baru</button>
      </div>

      <!-- Agent list -->
      <div class="agents-grid" id="agentsGrid">
        ${agents.length === 0 ? renderEmptyState() : agents.map(renderAgentCard).join('')}
      </div>
    </div>

    <!-- Modal create/edit -->
    <div class="modal-overlay" id="agentModalOverlay" style="display:none">
      <div class="modal" id="agentModal">
        <div class="modal-header">
          <h3 id="modalTitle">Buat Agent Baru</h3>
          <button class="btn-close-modal" id="btnCloseModal">✕</button>
        </div>
        <div class="modal-body" id="modalBody">
          ${renderAgentForm()}
        </div>
      </div>
    </div>

    <!-- Chat drawer -->
    <div class="drawer-overlay" id="chatOverlay"></div>
    <div class="drawer chat-drawer" id="chatDrawer">
      <div class="drawer-header">
        <div>
          <h3 id="chatAgentName">Agent</h3>
          <p class="drawer-subtitle" id="chatAgentModel">—</p>
        </div>
        <button class="btn-close-drawer" id="btnCloseChat">✕</button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-welcome">
          <div class="chat-welcome-icon">🤖</div>
          <p>Mulai percakapan dengan agent ini.</p>
          <p class="chat-welcome-hint">Agent akan menganalisis data kampanye yang sedang ditampilkan.</p>
        </div>
      </div>
      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <textarea id="chatInput" placeholder="Tanya sesuatu tentang kampanye kamu..." rows="1"></textarea>
          <button class="chat-send-btn" id="btnSendChat">➤</button>
        </div>
        <div class="chat-quick-actions">
          <button class="chat-quick-btn" data-q="Berikan ringkasan performa kampanye saat ini">📊 Ringkasan</button>
          <button class="chat-quick-btn" data-q="Kampanye mana yang performanya paling buruk dan kenapa?">⚠️ Terburuk</button>
          <button class="chat-quick-btn" data-q="Berikan 3 rekomendasi optimasi yang bisa dilakukan sekarang">💡 Rekomendasi</button>
          <button class="chat-quick-btn" data-q="Analisis CTR dan CPM semua kampanye aktif">📈 CTR & CPM</button>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="agents-empty">
      <div class="agents-empty-icon">🤖</div>
      <h3>Belum ada agent</h3>
      <p>Buat agent pertama kamu untuk mulai menganalisis data kampanye dengan AI.</p>
      <button class="btn-primary" id="btnCreateAgentEmpty">+ Buat Agent Pertama</button>
    </div>
  `;
}

function renderAgentCard(agent) {
  const lastRun = agent.lastRunAt
    ? new Date(agent.lastRunAt).toLocaleString('id-ID')
    : 'Belum pernah dijalankan';

  const dataLabels = {
    account:   '👤 Akun',
    campaigns: '📋 Kampanye',
    insights:  '📊 Insights',
  };

  return `
    <div class="agent-card" data-id="${agent.id}">
      <div class="agent-card-header">
        <div class="agent-avatar">🤖</div>
        <div class="agent-info">
          <div class="agent-name">${escHtml(agent.name)}</div>
          <div class="agent-model">${escHtml(agent.model)}</div>
        </div>
        <div class="agent-actions">
          <button class="agent-btn-run"  data-id="${agent.id}" title="Jalankan">💬</button>
          <button class="agent-btn-edit" data-id="${agent.id}" title="Edit">✏️</button>
          <button class="agent-btn-del"  data-id="${agent.id}" title="Hapus">🗑</button>
        </div>
      </div>
      ${agent.description ? `<p class="agent-desc">${escHtml(agent.description)}</p>` : ''}
      <div class="agent-meta">
        <div class="agent-access-tags">
          ${agent.dataAccess.map(d => `<span class="agent-tag">${dataLabels[d] || d}</span>`).join('')}
        </div>
        <span class="agent-last-run">⏱ ${lastRun}</span>
      </div>
    </div>
  `;
}

function renderAgentForm(agent = null) {
  const v = agent || {};
  return `
    <form id="agentForm">
      <div class="form-group">
        <label>Nama Agent <span class="required">*</span></label>
        <input type="text" id="fName" value="${escHtml(v.name || '')}" placeholder="e.g. Meta Ads Analyst" required />
      </div>
      <div class="form-group">
        <label>Deskripsi</label>
        <input type="text" id="fDesc" value="${escHtml(v.description || '')}" placeholder="Fungsi agent ini..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Model <span class="required">*</span></label>
          <select id="fModel">
            <option value="gpt-4o-mini"      ${(v.model||'gpt-4o-mini') === 'gpt-4o-mini'      ? 'selected' : ''}>GPT-4o Mini</option>
            <option value="gpt-4o"           ${v.model === 'gpt-4o'           ? 'selected' : ''}>GPT-4o</option>
            <option value="gpt-3.5-turbo"    ${v.model === 'gpt-3.5-turbo'    ? 'selected' : ''}>GPT-3.5 Turbo</option>
            <option value="claude-3-haiku-20240307"   ${v.model === 'claude-3-haiku-20240307'   ? 'selected' : ''}>Claude 3 Haiku</option>
            <option value="claude-3-5-sonnet-20241022" ${v.model === 'claude-3-5-sonnet-20241022' ? 'selected' : ''}>Claude 3.5 Sonnet</option>
            <option value="custom"           ${v.model === 'custom'           ? 'selected' : ''}>Custom...</option>
          </select>
        </div>
        <div class="form-group" id="customModelGroup" style="${v.model === 'custom' ? '' : 'display:none'}">
          <label>Custom Model Name</label>
          <input type="text" id="fCustomModel" value="${v.model === 'custom' ? escHtml(v.customModel || '') : ''}" placeholder="model-name" />
        </div>
      </div>
      <div class="form-group">
        <label>API Base URL <span class="required">*</span></label>
        <input type="url" id="fApiBase" value="${escHtml(v.apiBase || 'https://api.openai.com/v1')}" placeholder="https://api.openai.com/v1" required />
        <small>Untuk OpenAI-compatible API (OpenAI, Together, Groq, dll)</small>
      </div>
      <div class="form-group">
        <label>API Key <span class="required">*</span></label>
        <div class="input-with-toggle">
          <input type="password" id="fApiKey" value="${escHtml(v.apiKey || '')}" placeholder="sk-..." required />
          <button type="button" class="btn-eye" id="btnToggleKey">👁</button>
        </div>
        <small>Disimpan di localStorage browser kamu, tidak dikirim ke server kami.</small>
      </div>
      <div class="form-group">
        <label>Akses Data</label>
        <div class="checkbox-group">
          <label class="checkbox-item">
            <input type="checkbox" name="dataAccess" value="account"   ${(v.dataAccess||['campaigns','insights']).includes('account')   ? 'checked' : ''}> 👤 Akun
          </label>
          <label class="checkbox-item">
            <input type="checkbox" name="dataAccess" value="campaigns" ${(v.dataAccess||['campaigns','insights']).includes('campaigns') ? 'checked' : ''}> 📋 Kampanye
          </label>
          <label class="checkbox-item">
            <input type="checkbox" name="dataAccess" value="insights"  ${(v.dataAccess||['campaigns','insights']).includes('insights')  ? 'checked' : ''}> 📊 Insights
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>System Prompt</label>
        <textarea id="fSystemPrompt" rows="5" placeholder="Instruksi untuk agent...">${escHtml(v.systemPrompt || defaultSystemPrompt())}</textarea>
        <small>Instruksi dasar yang selalu dikirim ke AI sebelum percakapan.</small>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="btnCancelForm">Batal</button>
        <button type="submit" class="btn-primary">${agent ? 'Simpan Perubahan' : 'Buat Agent'}</button>
      </div>
    </form>
  `;
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event wiring for agents page ──────────────────────

let _activeChatAgent  = null;
let _chatHistory      = [];

export function initAgentEvents() {
  const $ = id => document.getElementById(id);

  // Open create modal
  document.getElementById('btnCreateAgent')?.addEventListener('click', () => openModal());
  document.getElementById('btnCreateAgentEmpty')?.addEventListener('click', () => openModal());

  // Close modal
  $('btnCloseModal')?.addEventListener('click', closeModal);
  $('agentModalOverlay')?.addEventListener('click', e => {
    if (e.target === $('agentModalOverlay')) closeModal();
  });

  // Agent card actions (delegated)
  $('agentsGrid')?.addEventListener('click', e => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    if (e.target.closest('.agent-btn-run'))  openChat(id);
    if (e.target.closest('.agent-btn-edit')) openModal(id);
    if (e.target.closest('.agent-btn-del'))  confirmDelete(id);
  });

  // Chat
  $('btnCloseChat')?.addEventListener('click', closeChat);
  $('chatOverlay')?.addEventListener('click', closeChat);
  $('btnSendChat')?.addEventListener('click', sendChat);
  $('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // Quick action buttons
  document.querySelectorAll('.chat-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $('chatInput');
      if (input) { input.value = btn.dataset.q; sendChat(); }
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeChat(); }
  });
}

function openModal(agentId = null) {
  const $ = id => document.getElementById(id);
  const agent = agentId ? getAgents().find(a => a.id === agentId) : null;

  $('modalTitle').textContent = agent ? 'Edit Agent' : 'Buat Agent Baru';
  $('modalBody').innerHTML    = renderAgentForm(agent);
  $('agentModalOverlay').style.display = 'flex';

  // Toggle password visibility
  $('btnToggleKey')?.addEventListener('click', () => {
    const inp = $('fApiKey');
    inp.type  = inp.type === 'password' ? 'text' : 'password';
  });

  // Custom model toggle
  $('fModel')?.addEventListener('change', e => {
    $('customModelGroup').style.display = e.target.value === 'custom' ? '' : 'none';
  });

  // Cancel
  $('btnCancelForm')?.addEventListener('click', closeModal);

  // Submit
  $('agentForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const checks    = [...document.querySelectorAll('input[name="dataAccess"]:checked')];
    const modelVal  = $('fModel').value;
    const modelName = modelVal === 'custom' ? ($('fCustomModel').value.trim() || 'custom') : modelVal;

    const data = {
      name:         $('fName').value,
      description:  $('fDesc').value,
      model:        modelName,
      apiBase:      $('fApiBase').value,
      apiKey:       $('fApiKey').value,
      systemPrompt: $('fSystemPrompt').value,
      dataAccess:   checks.map(c => c.value),
    };

    if (agentId) {
      updateAgent(agentId, data);
    } else {
      createAgent(data);
    }

    closeModal();
    refreshAgentsGrid();
  });
}

function closeModal() {
  document.getElementById('agentModalOverlay').style.display = 'none';
}

function confirmDelete(id) {
  const agent = getAgents().find(a => a.id === id);
  if (!agent) return;
  if (confirm(`Hapus agent "${agent.name}"?`)) {
    deleteAgent(id);
    refreshAgentsGrid();
  }
}

function refreshAgentsGrid() {
  const grid   = document.getElementById('agentsGrid');
  const agents = getAgents();
  grid.innerHTML = agents.length === 0 ? renderEmptyState() : agents.map(renderAgentCard).join('');

  // Re-bind empty state button if needed
  document.getElementById('btnCreateAgentEmpty')?.addEventListener('click', () => openModal());
}

function openChat(agentId) {
  const agent = getAgents().find(a => a.id === agentId);
  if (!agent) return;

  _activeChatAgent = agent;
  _chatHistory     = [];

  document.getElementById('chatAgentName').textContent  = agent.name;
  document.getElementById('chatAgentModel').textContent = agent.model;
  document.getElementById('chatMessages').innerHTML     = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">🤖</div>
      <p><strong>${escHtml(agent.name)}</strong> siap menganalisis data kamu.</p>
      <p class="chat-welcome-hint">Data yang bisa diakses: ${agent.dataAccess.join(', ')}</p>
    </div>`;

  document.getElementById('chatDrawer').classList.add('open');
  document.getElementById('chatOverlay').classList.add('open');
  document.getElementById('chatInput').focus();
}

function closeChat() {
  document.getElementById('chatDrawer').classList.remove('open');
  document.getElementById('chatOverlay').classList.remove('open');
  _activeChatAgent = null;
  _chatHistory     = [];
}

async function sendChat() {
  if (!_activeChatAgent) return;

  const input   = document.getElementById('chatInput');
  const msg     = input.value.trim();
  if (!msg) return;

  input.value   = '';
  input.style.height = '';

  // Add user bubble
  appendMessage('user', msg);
  _chatHistory.push({ role: 'user', content: msg });

  // Typing indicator
  const typingId = appendTyping();

  try {
    const reply = await chatWithAgent(_activeChatAgent, _chatHistory);
    removeTyping(typingId);
    appendMessage('assistant', reply);
    _chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    removeTyping(typingId);
    appendMessage('error', '⚠️ ' + err.message);
  }
}

function appendMessage(role, content) {
  const box  = document.getElementById('chatMessages');
  const id   = 'msg_' + Date.now();
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const formatted = role === 'assistant'
    ? formatMarkdown(content)
    : escHtml(content);

  box.innerHTML += `
    <div class="chat-msg chat-msg-${role}" id="${id}">
      <div class="chat-bubble">${formatted}</div>
      <div class="chat-time">${time}</div>
    </div>`;

  box.scrollTop = box.scrollHeight;
  return id;
}

function appendTyping() {
  const id  = 'typing_' + Date.now();
  const box = document.getElementById('chatMessages');
  box.innerHTML += `
    <div class="chat-msg chat-msg-assistant" id="${id}">
      <div class="chat-bubble chat-typing">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  box.scrollTop = box.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

// Basic markdown → HTML
function formatMarkdown(text) {
  return escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>')
    .replace(/`(.*?)`/g,       '<code>$1</code>')
    .replace(/^### (.*)/gm,    '<h4>$1</h4>')
    .replace(/^## (.*)/gm,     '<h3>$1</h3>')
    .replace(/^- (.*)/gm,      '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g,           '<br><br>')
    .replace(/\n/g,             '<br>');
}
