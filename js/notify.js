// ============================================================================
//  Erinnerungen — lokale Push-Benachrichtigungen vor der nächsten Schlafphase
// ----------------------------------------------------------------------------
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
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;

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
  if (ok) show('🔔 Erinnerungen aktiv', 'Du wirst 30 Minuten vor der nächsten Schlafphase erinnert.');
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
  const t = prediction.time.getTime();
  const what = prediction.type === 'night' ? 'Schlafenszeit 🌙' : `${prediction.napNumber}. Nickerchen 😴`;
  const lead = LEAD_MIN * 60 * 1000;

  if (t - lead > now) {
    timers.push(setTimeout(
      () => show('😴 Bald müde', `In ${LEAD_MIN} Minuten: ${what} (ca. ${fmtClock(prediction.time)}).`),
      t - lead - now,
    ));
  }
  if (t > now) {
    timers.push(setTimeout(
      () => show('🌙 Zeit zum Schlafen', `${what} — jetzt ist ein gutes Zeitfenster.`),
      t - now,
    ));
  }
}
