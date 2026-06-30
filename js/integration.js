const STORAGE_KEY = 'shopee_integration_auth';
const API_BASE = 'https://marketing-hub-be.vercel.app/api';

export function renderIntegrationPage() {
  const saved = getSavedIntegration();

  return `
    <div class="bot-page">
      <div class="bot-page-header">
        <h2 class="bot-title">Marketplace Integration</h2>
        <p class="bot-subtitle">
          Kelola autentikasi marketplace, login API, dan refresh token.
        </p>
      </div>

      <div class="account-bar" style="display:flex">
        <div class="account-info">
          <span class="account-avatar">🛍️</span>

          <div>
            <div class="account-name">
              Shopee Ads Account
            </div>

            <div class="account-id">
              ${saved.shopId || 'Belum terhubung'} · Marketplace
            </div>
          </div>
        </div>

        <div class="account-spend-info">
          <div class="spend-stat">
            <span class="spend-label">Saldo</span>
            <span class="spend-val" id="shopeeBalanceDisplay">
              Rp 0
            </span>
          </div>

          <div class="spend-stat">
            <span class="spend-label">Partner ID</span>
            <span class="spend-val">
              ${saved.partnerId || '-'}
            </span>
          </div>
        </div>

        <div class="account-actions">
          <span class="status-dot ${saved.accessToken ? 'active' : ''}"></span>

          <span class="status-text">
            ${saved.accessToken ? 'Terhubung' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div class="bot-card">
        <div class="bot-card-body">

          <input type="hidden" id="shopeePartnerId" value="${saved.partnerId || ''}" />
          <input type="hidden" id="shopeeShopId" value="${saved.shopId || ''}" />
          <textarea id="shopeeAccessToken" hidden>${saved.accessToken || ''}</textarea>
          <textarea id="shopeeRefreshToken" hidden>${saved.refreshToken || ''}</textarea>

          <div class="bot-connection-status ${saved.accessToken ? 'connected' : 'disconnected'}">
            <span class="bot-status-dot"></span>
            <span class="bot-status-label">
              ${saved.accessToken ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div class="bot-info-box">
            Klik tombol <strong>Integrasi Shopee</strong> untuk login dan menghubungkan akun Shopee secara otomatis.
          </div>

          <div class="bot-actions">
            <button class="btn-primary" id="btnShopeeDirectAuth">
              Integrasi Shopee
            </button>

            <button class="btn-secondary" id="btnTestShopeeLogin">
              Test Login
            </button>
          </div>

          <div class="bot-info-box">
            Data integrasi disimpan di browser menggunakan
            <code>localStorage</code>
          </div>

          <div id="integrationStatus"></div>

        </div>
      </div>
    </div>
  `;
}

export function initIntegrationEvents() {
  const authBtn = document.getElementById('btnShopeeDirectAuth');
  const testBtn = document.getElementById('btnTestShopeeLogin');

  syncSavedIntegrationToBackend();
  loadShopeeBalance();

  authBtn?.addEventListener('click', async () => {
    try {
      setStatus('loading', 'Mengarahkan ke Shopee OAuth...');

      const res = await fetch(`${API_BASE}/shopee/auth/url`);
      const data = await res.json();

      if (!data.success || !data.authUrl) {
        throw new Error(data.error || 'Gagal membuat auth URL');
      }

      const popup = window.open(
        data.authUrl,
        'ShopeeAuth',
        'width=720,height=820'
      );

      if (!popup) {
        throw new Error('Popup diblokir browser.');
      }

      window.addEventListener('message', async event => {
        if (event.data?.type !== 'SHOPEE_AUTH_SUCCESS') return;

        document.getElementById('shopeePartnerId').value =
          event.data.partnerId || '';

        document.getElementById('shopeeShopId').value =
          event.data.shopId || '';

        document.getElementById('shopeeAccessToken').value =
          event.data.accessToken || '';

        document.getElementById('shopeeRefreshToken').value =
          event.data.refreshToken || '';

        const payload = collectForm();

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(payload)
        );

        await fetch(`${API_BASE}/shopee/integration/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        setStatus(
          'success',
          'Integrasi Shopee berhasil disimpan.'
        );
      });
    } catch (error) {
      setStatus('error', error.message || 'OAuth Shopee gagal.');
    }
  });

  testBtn?.addEventListener('click', async () => {
    const payload = collectForm();

    setStatus('loading', 'Mencoba login Shopee API...');

    try {
      await fakeRequest();

      if (!payload.accessToken) {
        throw new Error('Access token belum diisi.');
      }

      setStatus('success', 'Login Shopee API berhasil.');
    } catch (error) {
      setStatus('error', error.message || 'Login gagal.');
    }
  });

}

function collectForm() {
  return {
    partnerId: document.getElementById('shopeePartnerId')?.value || '',
    shopId: document.getElementById('shopeeShopId')?.value || '',
    accessToken: document.getElementById('shopeeAccessToken')?.value || '',
    refreshToken: document.getElementById('shopeeRefreshToken')?.value || ''
  };
}

function getSavedIntegration() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setStatus(type, message) {
  const el = document.getElementById('integrationStatus');

  if (!el) return;

  el.className = `bot-status bot-status-${type}`;
  el.textContent = message;
}

async function syncSavedIntegrationToBackend() {
  try {
    const saved = getSavedIntegration();

    if (!saved?.accessToken || !saved?.shopId) {
      return;
    }

    await fetch(`${API_BASE}/shopee/integration/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(saved)
    });
  } catch (error) {
    console.error('Gagal sinkron integrasi Shopee:', error);
  }
}

async function loadShopeeBalance() {
  try {
    const saved = getSavedIntegration();

    if (!saved?.accessToken || !saved?.shopId) {
      return;
    }

    const res = await fetch(
      `${API_BASE}/shopee/ads/wallet`
    );

    const data = await res.json();

    const balance =
      data?.data?.balance ||
      data?.balance ||
      0;

    const el = document.getElementById(
      'shopeeBalanceDisplay'
    );

    if (el) {
      el.innerHTML =
        'Rp ' + Number(balance).toLocaleString('id-ID');
    }
  } catch (error) {
    console.error('Gagal mengambil saldo Shopee:', error);
  }
}

function fakeRequest() {
  return new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
}
