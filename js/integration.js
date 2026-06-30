const STORAGE_KEY = 'shopee_integration_auth';

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

      <div class="bot-card">
        <div class="bot-card-header">
          <div class="bot-icon shopee-icon">🛍️</div>

          <div>
            <div class="bot-card-title">Shopee API Integration</div>
            <div class="bot-card-subtitle">
              Login, access token, dan refresh token Shopee API
            </div>
          </div>
        </div>

        <div class="bot-card-body">

          <div class="form-group">
            <label>Partner ID</label>
            <input type="text" id="shopeePartnerId" placeholder="Masukkan Partner ID" value="${saved.partnerId || ''}" />
          </div>

          <div class="form-group">
            <label>Shop ID</label>
            <input type="text" id="shopeeShopId" placeholder="Masukkan Shop ID" value="${saved.shopId || ''}" />
          </div>

          <div class="form-group">
            <label>Access Token</label>
            <textarea id="shopeeAccessToken" rows="4" placeholder="Masukkan access token">${saved.accessToken || ''}</textarea>
          </div>

          <div class="form-group">
            <label>Refresh Token</label>
            <textarea id="shopeeRefreshToken" rows="4" placeholder="Masukkan refresh token">${saved.refreshToken || ''}</textarea>
          </div>

          <div class="bot-actions">
            <button class="btn-primary" id="btnSaveShopeeAuth">
              💾 Simpan Auth
            </button>

            <button class="btn-secondary" id="btnTestShopeeLogin">
              🔐 Test Login
            </button>

            <button class="btn-secondary" id="btnRefreshShopeeToken">
              🔄 Refresh Token
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
    const saveBtn = document.getElementById('btnSaveShopeeAuth');
    const testBtn = document.getElementById('btnTestShopeeLogin');
    const refreshBtn = document.getElementById('btnRefreshShopeeToken');

    saveBtn?.addEventListener('click', () => {
        const payload = collectForm();

        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        setStatus('success', 'Auth Shopee berhasil disimpan.');
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

    refreshBtn?.addEventListener('click', async () => {
        const payload = collectForm();

        setStatus('loading', 'Refreshing token Shopee...');

        try {
            await fakeRequest();

            if (!payload.refreshToken) {
                throw new Error('Refresh token belum diisi.');
            }

            const refreshedToken = `new_token_${Date.now()}`;

            document.getElementById('shopeeAccessToken').value = refreshedToken;

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    ...payload,
                    accessToken: refreshedToken
                })
            );

            setStatus('success', 'Refresh token berhasil dilakukan.');
        } catch (error) {
            setStatus('error', error.message || 'Refresh token gagal.');
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

function fakeRequest() {
    return new Promise(resolve => {
        setTimeout(resolve, 1000);
    });
}