// ============================================================================
//  App-Bootstrap
// ============================================================================
import { render, bindEvents } from './ui.js';
import { store } from './store.js';

bindEvents();
render();

// Bei jeder Datenänderung neu rendern (z. B. aus anderem Tab)
store.subscribe(() => render());
window.addEventListener('storage', () => location.reload());

// Service Worker für Offline-Betrieb / Installierbarkeit
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker Registrierung fehlgeschlagen:', err);
    });
  });
}
