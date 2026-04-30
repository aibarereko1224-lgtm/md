/* ============================================
   Moon Dust - Main Application Entry
   ============================================ */

import { ui } from './ui.js';
import { storage } from './storage.js';
import { CONFIG } from './config.js';

/**
 * Application initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  ui.init();

  // Log initialization
  if (CONFIG.DEV_MODE) {
    console.log('Moon Dust initialized');
    console.log('Storage:', storage.getRecords().length, 'records');
  }
});

// Export for debugging
window.MoonDust = {
  ui,
  storage,
  CONFIG
};