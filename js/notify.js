// ============================================================================
//  Erinnerungen — lokale Push-Benachrichtigungen vor der nächsten Schlafphase
// ----------------------------------------------------------------------------
import { t } from './i18n.js';

//  Plant eine Benachrichtigung 30 Minuten vor dem vorhergesagten Schlaf und
//  eine zum Zeitpunkt selbst. Die Erinnerungen werden bei jeder Neuberechnung
//  neu gesetzt (z. B. wenn sich die Prognose durch neue Einträge verschiebt).
//
//  Hinweis: Ausgelöst wird zuverlässig, solange die App geöffnet oder im
//  Hintergrund aktiv ist. Bei komplett geschlossener App sind zeitgesteuerte
//  Web-Benachrichtigungen je nach Gerät/Browser eingeschränkt.
// ============================================================================
const KEY = 'babysleep.notify';
const LEAD_MIN = 30; // Vorlaufzeit in Minuten
let timers = [];

const pad = (n) => String(n).padStart(2, '0');
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function notifySupported() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export function notifyEnabled() {
  try {
    return localStorage.getItem(KEY) === '1' &&
      notifySupported() && Notification.permission === 'granted';
  } catch { return false; }
}

export async function enableNotifications() {
  if (!notifySupported()) return false;
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();
  const ok = perm === 'granted';
  try { localStorage.setItem(KEY, ok ? '1' : '0'); } catch { /* ignore */ }
  if (ok) show(t('ntf_active_title'), t('ntf_active_body'));
  return ok;
}

export function disableNotifications() {
  try { localStorage.setItem(KEY, '0'); } catch { /* ignore */ }
  clearTimers();
}

function clearTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

async function show(title, body) {
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'schlummer-reminder',
      renotify: true,
    });
  } catch {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}

// Erinnerungen für die nächste vorhergesagte Schlafphase planen
export function schedule(prediction) {
  clearTimers();
  if (!notifyEnabled() || !prediction || prediction.kind !== 'sleep') return;

  const now = Date.now();
  const target = prediction.time.getTime();
  const what = prediction.type === 'night' ? t('ntf_what_night') : t('ntf_what_nap', { n: prediction.napNumber });
  const lead = LEAD_MIN * 60 * 1000;

  if (target - lead > now) {
    timers.push(setTimeout(
      () => show(t('ntf_soon_title'), t('ntf_soon_body', { min: LEAD_MIN, what, t: fmtClock(prediction.time) })),
      target - lead - now,
    ));
  }
  if (target > now) {
    timers.push(setTimeout(
      () => show(t('ntf_now_title'), t('ntf_now_body', { what })),
      target - now,
    ));
  }
}
