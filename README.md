# Meta Ads Frontend

Dashboard Meta Ads — pure HTML + CSS + Vanilla JS, tidak perlu build step.

## Setup

1. Buka `js/config.js` dan ubah `API_BASE` ke URL backend kamu:
   ```js
   export const API_BASE = 'https://your-backend.railway.app/api';
   ```

2. Opsional: set `FALLBACK_TOKEN` di `js/config.js` (token default saat pertama buka)

## Menjalankan Lokal

Karena menggunakan ES Modules (`type="module"`), **harus** dijalankan dari server lokal, bukan dibuka langsung sebagai file.

Opsi termudah:
```bash
# Menggunakan VS Code Live Server extension (klik kanan index.html → Open with Live Server)

# Atau menggunakan Python
python -m http.server 8080

# Atau menggunakan Node http-server
npx http-server . -p 8080
```

Buka http://localhost:8080

## Deploy

Upload semua file di folder `frontend/` ke GitHub Pages, Netlify, atau Vercel. Tidak ada build step yang diperlukan.

Pastikan `js/config.js` sudah di-update dengan URL backend produksi sebelum deploy.

## Struktur

```
frontend/
├── index.html       # Single page app
├── style.css        # Semua styling
└── js/
    ├── main.js      # Entry point (boot app)
    ├── config.js    # Konstanta & konfigurasi
    ├── api.js       # HTTP calls ke backend
    ├── state.js     # App state
    ├── helpers.js   # Utility functions
    ├── tokenManager.js  # Token lifecycle
    ├── controller.js    # Event wiring & data fetching
    └── renderer.js      # DOM rendering
```
