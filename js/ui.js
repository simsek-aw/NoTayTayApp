// ============================================================================
//  UI — Rendering & Interaktion
// ============================================================================
import { store } from './store.js';
import { predict, ageProfile, ageInDays, fmtDuration } from './engine.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

function fmtTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtClock(d) {
  return fmtTime(d) + ' Uhr';
}
function elapsed(from, to = new Date()) {
  const s = Math.max(0, Math.floor((to - from) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function relDay(d) {
  const now = new Date();
  const t = new Date(d);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - startOfToday) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === -1) return 'Gestern';
  return t.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => (t.hidden = true), 300);
  }, 2200);
}

// Standard-Geburtsdatum: heute minus 8 Monate (Format YYYY-MM-DD)
function defaultBirthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 8);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Zufälligen, gut lesbaren Familien-Code erzeugen (keine mehrdeutigen Zeichen)
function genFamilyCode() {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  bytes.forEach((b) => { s += alpha[b % alpha.length]; });
  return s.match(/.{1,4}/g).join('-'); // z. B. K7QF-M3PX-9RTA
}

// Sync-Status im Einstellungen-Menü anzeigen
function updateSyncUI(status, detail) {
  const badge = $('sync-badge');
  const setup = $('sync-setup');
  const conn = $('sync-connected');
  const unavailable = $('sync-unavailable');
  const intro = $('sync-intro');

  if (!store.syncAvailable()) {
    unavailable.hidden = false;
    setup.hidden = true;
    conn.hidden = true;
    intro.hidden = true;
    badge.textContent = 'n/v';
    badge.className = 'sync-badge';
    return;
  }
  unavailable.hidden = true;
  intro.hidden = false;

  const map = {
    connecting: ['verbindet…', 'badge-warn'],
    connected: ['verbunden', 'badge-ok'],
    error: ['Fehler', 'badge-err'],
    disconnected: ['aus', ''],
    unavailable: ['n/v', ''],
  };
  const [label, cls] = map[status] || ['aus', ''];
  badge.textContent = label;
  badge.className = 'sync-badge ' + cls;

  const isConn = status === 'connected';
  conn.hidden = !isConn;
  setup.hidden = isConn;
  if (isConn) {
    $('sync-code-shown').textContent = store.getFamilyCode() || '';
  }
  if (status === 'error' && detail) toast('Sync-Fehler: ' + detail);
}

// datetime-local Wert aus Date
function toLocalInput(d) {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
//  Haupt-Render
// ---------------------------------------------------------------------------
export function render() {
  const state = store.get();

  // Onboarding erzwingen, wenn kein Geburtsdatum
  if (!state.baby.birthDate) {
    // Standard: Kind ist 8 Monate alt (dynamisch berechnet)
    if (!$('ob-date').value) $('ob-date').value = defaultBirthDate();
    $('onboarding').hidden = false;
  }

  // Kopfzeile
  $('baby-name').textContent = state.baby.name || 'Baby';
  const days = ageInDays(state.baby.birthDate);
  if (days != null) {
    const prof = ageProfile(state.baby.birthDate);
    const weeks = Math.floor(days / 7);
    const ageStr = days < 90 ? `${weeks} Wo. (${days} T.)` : `${Math.round(days / 30.44)} Mon.`;
    $('baby-age').textContent = `${ageStr} · ${prof.label}`;
  } else {
    $('baby-age').textContent = '';
  }

  const pred = predict(state.sessions, state.baby.birthDate);
  renderStatus(pred);
  renderActions(pred);
  renderNext(pred);
  renderPlan(pred);
  renderHistory();
}

function renderStatus(pred) {
  const card = $('status-card');
  card.classList.toggle('asleep', pred.status === 'asleep');
  card.classList.toggle('awake', pred.status === 'awake');

  if (pred.status === 'asleep') {
    const start = new Date(pred.active.start);
    $('status-label').textContent = pred.sleepType === 'night' ? '🌙 Schläft (Nacht)' : '😴 Schläft';
    $('status-timer').textContent = elapsed(start);
    $('status-timer').dataset.since = start.toISOString();
    $('status-timer').dataset.mode = 'up';
    $('status-sub').textContent = `seit ${fmtClock(start)}`;
  } else {
    $('status-label').textContent = '☀️ Wach';
    if (pred.lastWake) {
      $('status-timer').textContent = elapsed(pred.lastWake);
      $('status-timer').dataset.since = pred.lastWake.toISOString();
      $('status-timer').dataset.mode = 'up';
      $('status-sub').textContent = `wach seit ${fmtClock(pred.lastWake)}`;
    } else {
      $('status-timer').textContent = '–';
      delete $('status-timer').dataset.since;
      $('status-sub').textContent = 'Noch keine Daten';
    }
  }
}

function renderActions(pred) {
  const el = $('actions');
  el.innerHTML = '';

  if (pred.status === 'asleep') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-block btn-big';
    btn.textContent = pred.sleepType === 'night' ? '🌅 Nacht beenden (aufgewacht)' : '⏹ Nickerchen beenden';
    btn.onclick = () => {
      store.stop();
      toast('Aufgewacht — gut geschlafen! 👶');
      render();
    };
    el.appendChild(btn);
  } else {
    const nap = document.createElement('button');
    nap.className = 'btn btn-primary btn-block btn-big';
    nap.textContent = '😴 Nickerchen starten';
    nap.onclick = () => {
      store.start('nap');
      toast('Nickerchen gestartet');
      render();
    };
    el.appendChild(nap);

    const night = document.createElement('button');
    night.className = 'btn btn-ghost btn-block';
    night.textContent = '🌙 Schlafenszeit (Nacht) starten';
    night.onclick = () => {
      store.start('night');
      toast('Gute Nacht! 🌙');
      render();
    };
    el.appendChild(night);
  }

  const manual = document.createElement('button');
  manual.className = 'link-btn';
  manual.textContent = '+ Eintrag manuell hinzufügen';
  manual.onclick = () => openManual(null);
  el.appendChild(manual);
}

function renderNext(pred) {
  const card = $('next-card');
  if (!pred.prediction) { card.hidden = true; return; }
  card.hidden = false;
  const p = pred.prediction;

  if (p.kind === 'wake') {
    $('next-icon').textContent = '🌅';
    $('next-time').textContent = fmtClock(p.time);
    $('next-desc').textContent = p.label + (p.napNumber ? ` · ${p.napNumber}. Nickerchen läuft` : '');
    $('next-meta').textContent = `Fenster ${fmtTime(p.rangeStart)}–${fmtTime(p.rangeEnd)} Uhr`;
  } else {
    $('next-icon').textContent = p.type === 'night' ? '🌙' : '😴';
    $('next-time').textContent = fmtClock(p.time);
    const now = new Date();
    const mins = Math.round((p.time - now) / 60000);
    const inTxt = mins > 0 ? `in ${fmtDuration(mins)}` : `jetzt (überfällig ${fmtDuration(-mins)})`;
    $('next-desc').textContent = `${p.label} · ${inTxt}`;
    $('next-meta').textContent =
      `Wachfenster ${fmtDuration(p.wakeWindow)} · ideales Fenster ${fmtTime(p.rangeStart)}–${fmtTime(p.rangeEnd)} Uhr`;
  }

  const conf = $('confidence');
  const level = p.confidence;
  conf.textContent = `Genauigkeit: ${level}`;
  conf.className = 'confidence conf-' + (level === 'hoch' ? 'high' : level === 'mittel' ? 'mid' : 'low');
}

function renderPlan(pred) {
  const card = $('plan-card');
  const list = $('timeline');
  list.innerHTML = '';
  if (!pred.plan || !pred.plan.length) { card.hidden = true; return; }
  card.hidden = false;

  for (const item of pred.plan) {
    const li = document.createElement('li');
    li.className = 'tl-item tl-' + item.type;
    if (item.type === 'nap') {
      li.innerHTML = `
        <span class="tl-dot">😴</span>
        <div class="tl-body">
          <div class="tl-title">${item.label}</div>
          <div class="tl-sub">${fmtClock(item.onset)} – ${fmtClock(item.wake)} · ${fmtDuration(item.duration)}</div>
        </div>`;
    } else {
      li.innerHTML = `
        <span class="tl-dot">🌙</span>
        <div class="tl-body">
          <div class="tl-title">Schlafenszeit</div>
          <div class="tl-sub">ca. ${fmtClock(item.onset)}</div>
        </div>`;
    }
    list.appendChild(li);
  }
}

function renderHistory() {
  const list = $('history');
  const sessions = store.sessionsSorted().slice(0, 40);
  list.innerHTML = '';
  $('empty-history').hidden = sessions.length > 0;

  let lastDay = null;
  for (const s of sessions) {
    const day = relDay(s.start);
    if (day !== lastDay) {
      const h = document.createElement('li');
      h.className = 'history-day';
      h.textContent = day;
      list.appendChild(h);
      lastDay = day;
    }

    const li = document.createElement('li');
    li.className = 'history-item';
    const start = new Date(s.start);
    const icon = s.type === 'night' ? '🌙' : '😴';
    const typeLabel = s.type === 'night' ? 'Nacht' : 'Nickerchen';
    let durTxt = '';
    if (s.end) {
      const mins = Math.round((new Date(s.end) - start) / 60000);
      durTxt = `${fmtTime(start)}–${fmtTime(new Date(s.end))} · ${fmtDuration(mins)}`;
    } else {
      durTxt = `${fmtTime(start)} · läuft …`;
    }
    li.innerHTML = `
      <span class="hi-icon">${icon}</span>
      <div class="hi-body">
        <div class="hi-title">${typeLabel}</div>
        <div class="hi-sub">${durTxt}</div>
      </div>
      <button class="icon-btn hi-edit" aria-label="Bearbeiten">✎</button>`;
    li.querySelector('.hi-edit').onclick = () => openManual(s);
    list.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
//  Manueller Eintrag / Bearbeiten
// ---------------------------------------------------------------------------
let editingId = null;

function openManual(session) {
  editingId = session ? session.id : null;
  $('manual-title').textContent = session ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen';
  $('man-type').value = session ? session.type : 'nap';
  $('man-start').value = toLocalInput(session ? session.start : new Date());
  $('man-end').value = session && session.end ? toLocalInput(session.end) : '';
  $('man-delete').hidden = !session;
  $('manual').hidden = false;
}

function closeManual() { $('manual').hidden = true; editingId = null; }

// ---------------------------------------------------------------------------
//  Live-Timer (Statusanzeige jede Sekunde aktualisieren)
// ---------------------------------------------------------------------------
function tickTimer() {
  const t = $('status-timer');
  if (t && t.dataset.since) {
    t.textContent = elapsed(new Date(t.dataset.since));
  }
}

// ---------------------------------------------------------------------------
//  Event-Bindung
// ---------------------------------------------------------------------------
export function bindEvents() {
  // Onboarding
  $('ob-save').onclick = () => {
    const name = $('ob-name').value.trim();
    const date = $('ob-date').value;
    if (!date) { toast('Bitte Geburtsdatum eingeben'); return; }
    store.setBaby({ name, birthDate: date });
    $('onboarding').hidden = true;
    render();
  };

  // Einstellungen
  $('settings-btn').onclick = () => {
    const b = store.get().baby;
    $('set-name').value = b.name || '';
    $('set-date').value = b.birthDate || '';
    $('sync-code').value = store.getFamilyCode() || '';
    updateSyncUI(store.syncConnected() ? 'connected' : 'disconnected');
    $('settings').hidden = false;
  };

  // ---- Familien-Sync ----
  $('sync-gen').onclick = () => { $('sync-code').value = genFamilyCode(); };
  $('sync-connect').onclick = async () => {
    const code = ($('sync-code').value || '').trim().toUpperCase();
    if (code.length < 6) { toast('Bitte einen gültigen Code eingeben (oder erzeugen)'); return; }
    updateSyncUI('connecting');
    const ok = await store.connectSync(code, (status, detail) => updateSyncUI(status, detail));
    if (ok) { toast('Familien-Sync verbunden ✅'); render(); }
  };
  $('sync-copy').onclick = async () => {
    const code = store.getFamilyCode() || '';
    try { await navigator.clipboard.writeText(code); toast('Code kopiert 📋'); }
    catch { toast('Code: ' + code); }
  };
  $('sync-disconnect').onclick = () => {
    store.disconnectSync();
    updateSyncUI('disconnected');
    toast('Sync getrennt (Daten bleiben lokal erhalten)');
  };
  $('settings-close').onclick = () => $('settings').hidden = true;
  $('set-name').onchange = () => store.setBaby({ name: $('set-name').value.trim() });
  $('set-date').onchange = () => { store.setBaby({ birthDate: $('set-date').value }); render(); };

  $('export-btn').onclick = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schlummer-daten-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('import-btn').onclick = () => $('import-file').click();
  $('import-file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { store.importJSON(reader.result); render(); toast('Daten importiert'); }
      catch { toast('Import fehlgeschlagen'); }
    };
    reader.readAsText(file);
  };
  $('clear-btn').onclick = () => {
    if (confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.')) {
      store.clearAll();
      $('settings').hidden = true;
      render();
    }
  };

  // Manueller Eintrag
  $('manual-close').onclick = closeManual;
  $('man-save').onclick = () => {
    const type = $('man-type').value;
    const start = $('man-start').value;
    const end = $('man-end').value;
    if (!start) { toast('Bitte Beginn angeben'); return; }
    if (end && new Date(end) <= new Date(start)) { toast('Ende muss nach dem Beginn liegen'); return; }
    if (editingId) {
      store.updateSession(editingId, { type, start, end: end || null });
    } else {
      store.addManual({ type, start, end: end || null });
    }
    closeManual();
    render();
    toast('Gespeichert');
  };
  $('man-delete').onclick = () => {
    if (editingId && confirm('Diesen Eintrag löschen?')) {
      store.removeSession(editingId);
      closeManual();
      render();
    }
  };

  // Overlays schließen bei Klick auf Hintergrund
  document.querySelectorAll('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov && ov.id !== 'onboarding') ov.hidden = true;
    });
  });

  // Live-Timer & periodisches Neurendern der Vorhersagen
  setInterval(tickTimer, 1000);
  setInterval(render, 60000); // Vorhersagen jede Minute frisch berechnen
  // Neu rendern, wenn App wieder in den Vordergrund kommt
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}
