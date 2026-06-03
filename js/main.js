/**
 * Entry point — boots the application.
 */
import { TokenManager } from './tokenManager.js';
import { loadDashboard, initEvents } from './controller.js';
import { FALLBACK_TOKEN } from './config.js';
import { setToken } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Wire up all dashboard event listeners
  initEvents();

  // Set token from localStorage or fallback
  const stored = localStorage.getItem('mam_meta_token');
  const token  = stored || FALLBACK_TOKEN;
  setToken(token);

  // Inspect + auto-extend in background (non-blocking)
  TokenManager.init(FALLBACK_TOKEN).catch(console.warn);

  // Load dashboard data
  await loadDashboard();
});
