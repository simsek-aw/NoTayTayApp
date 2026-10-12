// ============================================================================
//  UI — Rendering & Interaktion
// ============================================================================
import { store } from './store.js';
import { predict, ageProfile, ageInDays, fmtDuration, daySummary, weeklyTrend, predictionReview, detectShift } from './engine.js';
import * as notify from './notify.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

function fmtTime(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
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
function toast(msg, undoFn) {
  const t = $('toast');
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (undoFn) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.textContent = 'Rückgängig';
    b.onclick = () => {
      clearTimeout(toastTimer);
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 300);
      undoFn();
    };
    t.appendChild(b);
  }
  t.hidden = false;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => (t.hidden = true), 300);
  }, undoFn ? 5000 : 2200);
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

// Status der Erinnerungen im Einstellungen-Menü anzeigen
function updateNotifyUI() {
  const badge = $('notify-badge');
  const enableBtn = $('notify-enable');
  const disableBtn = $('notify-disable');
  const unavailable = $('notify-unavailable');
  if (!notify.notifySupported()) {
    unavailable.hidden = false;
    enableBtn.hidden = true;
    disableBtn.hidden = true;
    badge.textContent = 'n/v';
    badge.className = 'sync-badge';
    return;
  }
  unavailable.hidden = true;
  const on = notify.notifyEnabled();
  badge.textContent = on ? 'an' : 'aus';
  badge.className = 'sync-badge ' + (on ? 'badge-ok' : '');
  enableBtn.hidden = on;
  disableBtn.hidden = !on;
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
  renderHome(state, pred);
  renderShift(state);
  renderSummary(state, pred);
  renderTrends(state);
  renderReview(state);
  renderHeatmap(state);
  renderPlan(pred);
  renderHistory();
  notify.schedule(pred.prediction);
}

// Kurzes haptisches Feedback (wo unterstützt)
function vibrate(ms = 12) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
//  Kinderarzt-Bericht: druck-/teilbare Zusammenfassung (window.print -> PDF)
// ---------------------------------------------------------------------------
function buildReport() {
  const state = store.get();
  const now = new Date();
  const prof = ageProfile(state.baby.birthDate, now);
  const days = ageInDays(state.baby.birthDate, now);
  const week = weeklyTrend(state.sessions, now, 7);
  const complete = week.filter((d) => d.nightMin > 0); // vollständige Tage (mit Nacht)
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const avgNaps = complete.length ? (complete.reduce((a, d) => a + d.napCount, 0) / complete.length).toFixed(1).replace('.', ',') : '–';
  const avgDay = avg(complete.map((d) => d.napMin));
  const avgNight = avg(complete.map((d) => d.nightMin));
  const avgTotal = avg(complete.map((d) => d.napMin + d.nightMin));
  const rev = predictionReview(state.sessions, state.baby.birthDate, now);

  const rows = week.map((d) => `<tr><td>${d.date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td><td>${d.napCount}×</td><td>${d.napMin ? fmtDuration(d.napMin) : '–'}</td><td>${d.nightMin ? fmtDuration(d.nightMin) : '–'}</td><td>${(d.napMin + d.nightMin) ? fmtDuration(d.napMin + d.nightMin) : '–'}</td></tr>`).join('');

  const ageStr = days < 90 ? `${Math.floor(days / 7)} Wochen` : `${Math.round(days / 30.44)} Monate`;
  let report = document.getElementById('report');
  if (!report) { report = document.createElement('div'); report.id = 'report'; document.body.appendChild(report); }
  report.innerHTML = `
    <div class="report-actions">
      <button class="btn" id="report-print">🖨️ Drucken / als PDF</button>
      <button class="btn" id="report-close">Schließen</button>
    </div>
    <h1>Schlafbericht – ${escapeHtml(state.baby.name)}</h1>
    <div class="rp-sub">Alter: ${ageStr} (geb. ${new Date(state.baby.birthDate).toLocaleDateString('de-DE')}) · Stand: ${now.toLocaleDateString('de-DE')} · Richtwert-Altersgruppe: ${prof.label}</div>
    <h2>Durchschnitt (vollständige Tage, letzte 7)</h2>
    <div class="rp-kpis">
      <div class="rp-kpi"><b>${avgNaps}</b> Nickerchen / Tag</div>
      <div class="rp-kpi"><b>${avgDay ? fmtDuration(avgDay) : '–'}</b> Tagschlaf / Tag</div>
      <div class="rp-kpi"><b>${avgNight ? fmtDuration(avgNight) : '–'}</b> Nachtschlaf</div>
      <div class="rp-kpi"><b>${avgTotal ? fmtDuration(avgTotal) : '–'}</b> Gesamtschlaf / Tag</div>
    </div>
    <h2>Tagesübersicht (7 Tage)</h2>
    <table><thead><tr><th>Tag</th><th>Nickerchen</th><th>Tagschlaf</th><th>Nacht</th><th>Gesamt</th></tr></thead><tbody>${rows}</tbody></table>
    ${rev ? `<h2>Prognose-Treffsicherheit (Nickerchen)</h2><p>Ø Abweichung ±${rev.avgAbs} Min · ${rev.within30}% im ±30-Min-Fenster (letzte ${rev.count}).</p>` : ''}
    <p style="margin-top:20px;font-size:11px;color:#888;">Erstellt mit Schlummer. Richtwerte dienen der Orientierung und ersetzen keine ärztliche Beratung.</p>
  `;
  report.hidden = false;
  document.getElementById('report-print').onclick = () => window.print();
  document.getElementById('report-close').onclick = () => { report.hidden = true; };
}

// ===========================================================================
//  STARTSEITE: Tagesleiste + Kreisdiagramm + Zentrum + Tracker + Tagesliste
// ===========================================================================
let selectedDay = startOfDayLocal(new Date());
let selectedIcon = null;
let arcWake = null;
let arcBed = null;
let arcIsToday = true;

function startOfDayLocal(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDayLocal(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Kreis-Geometrie: Wachtag als 240°-Bogen (Aufwachen unten-links -> über oben
// -> Schlafenszeit unten-rechts); unten bleibt die Nachtlücke.
const CLK_R = 120;
const CLK_C = 150;
function clkAngle(f) { return (210 - 240 * Math.max(0, Math.min(1, f))) * Math.PI / 180; }
function clkPt(f) { const a = clkAngle(f); return [CLK_C + CLK_R * Math.cos(a), CLK_C - CLK_R * Math.sin(a)]; }
function clkArc(f0, f1) {
  if (f1 <= f0 + 0.001) return '';
  const [x0, y0] = clkPt(f0); const [x1, y1] = clkPt(f1);
  const large = 240 * (f1 - f0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${CLK_R} ${CLK_R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
function clkIconPos(f) { const a = clkAngle(f); return { left: 50 + 40 * Math.cos(a), top: 50 - 40 * Math.sin(a) }; }

function renderHome(state, pred) {
  renderDateStrip();
  const m = dayModel(state, pred);
  renderClock(state, pred, m);
  renderTracker(state, pred);
  renderTodayList(state);
}

function renderDateStrip() {
  const strip = $('date-strip');
  strip.innerHTML = '';
  const today = startOfDayLocal(new Date());
  const wk = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const btn = document.createElement('button');
    btn.className = 'date-pill' + (sameDayLocal(d, selectedDay) ? ' sel' : '') + (sameDayLocal(d, today) ? ' is-today' : '');
    btn.innerHTML = `<span class="dp-dow">${wk[d.getDay()]}</span><span class="dp-num">${d.getDate()}</span>`;
    btn.onclick = () => { selectedDay = startOfDayLocal(d); selectedIcon = null; render(); };
    strip.appendChild(btn);
  }
  strip.scrollLeft = strip.scrollWidth;
}

function dayModel(state, pred) {
  const day = selectedDay;
  const isToday = sameDayLocal(day, new Date());
  const ss = state.sessions;
  const morningNight = ss.filter((s) => s.type === 'night' && s.end && sameDayLocal(new Date(s.end), day))
    .sort((a, b) => new Date(b.end) - new Date(a.end))[0];
  const naps = ss.filter((s) => s.type === 'nap' && sameDayLocal(new Date(s.start), day))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  let wake = morningNight ? new Date(morningNight.end)
    : naps.length ? new Date(new Date(naps[0].start).getTime() - 3 * 3600000)
    : new Date(startOfDayLocal(day).getTime() + 7.5 * 3600000);
  const nightStart = ss.filter((s) => s.type === 'night' && sameDayLocal(new Date(s.start), day))
    .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
  const predNaps = [];
  let predBed = null;
  if (isToday && pred.plan) {
    for (const it of pred.plan) {
      if (it.type === 'nap') predNaps.push(new Date(it.onset));
      else if (it.type === 'night') predBed = new Date(it.onset);
    }
  }
  const bed = nightStart ? new Date(nightStart.start) : (predBed || new Date(wake.getTime() + 13 * 3600000));
  return { day, isToday, wake, bed, naps, nightStart, predNaps };
}

function renderClock(state, pred, m) {
  arcWake = m.wake; arcBed = m.bed; arcIsToday = m.isToday;
  $('clock-track').setAttribute('d', clkArc(0, 1));
  const wrap = $('clock-icons');
  wrap.innerHTML = '';
  const span = (m.bed - m.wake) || 1;
  const fOf = (t) => (new Date(t) - m.wake) / span;
  const now = new Date();
  const addIcon = (f, emoji, cls, data) => {
    const p = clkIconPos(f);
    const el = document.createElement('button');
    el.className = 'clock-ic ' + cls;
    el.style.left = p.left + '%';
    el.style.top = p.top + '%';
    el.textContent = emoji;
    el.onclick = () => { selectedIcon = data; renderClockCenter(state, pred, m); vibrate(6); };
    wrap.appendChild(el);
  };
  addIcon(0, '🌅', 'done', { kind: 'wake', time: m.wake });
  for (const nap of m.naps) {
    addIcon(fOf(nap.start), '😴', nap.end ? 'done' : 'active', { kind: 'nap', start: nap.start, end: nap.end });
  }
  if (m.isToday) {
    for (const t of m.predNaps) {
      if (t > now) addIcon(fOf(t), '😴', 'pred', { kind: 'prednap', time: t });
    }
  }
  addIcon(1, '🌙', m.nightStart ? 'done' : 'pred', {
    kind: 'bed', time: m.bed,
    start: m.nightStart ? m.nightStart.start : null,
    end: m.nightStart ? m.nightStart.end : null,
  });
  renderClockCenter(state, pred, m);
  updateArc();
}

function setCenter(label, timeTxt, subTxt, isRange) {
  $('cc-label').textContent = label;
  $('cc-time').textContent = timeTxt;
  $('cc-time').classList.toggle('cc-range', !!isRange);
  $('cc-sub').textContent = subTxt || '';
}

function renderClockCenter(state, pred, m) {
  const center = $('clock-center');
  center.classList.remove('overdue');
  delete center.dataset.mode; delete center.dataset.start; delete center.dataset.target;

  if (selectedIcon) {
    const s = selectedIcon;
    if (s.kind === 'nap' && !s.end) {
      center.dataset.mode = 'active'; center.dataset.start = new Date(s.start).toISOString();
      setCenter('😴 Nickerchen läuft', elapsed(new Date(s.start)), `seit ${fmtClock(s.start)}`);
    } else if (s.kind === 'nap') {
      setCenter('😴 Nickerchen', `${fmtTime(s.start)}–${fmtTime(s.end)}`, fmtDuration(Math.round((new Date(s.end) - new Date(s.start)) / 60000)), true);
    } else if (s.kind === 'bed') {
      if (s.end) setCenter('🌙 Nacht', `${fmtTime(s.start)}–${fmtTime(s.end)}`, fmtDuration(Math.round((new Date(s.end) - new Date(s.start)) / 60000)), true);
      else setCenter('🌙 Schlafenszeit', fmtTime(s.time), 'Prognose');
    } else if (s.kind === 'wake') {
      setCenter('🌅 Aufwachen', fmtTime(s.time), '');
    } else {
      setCenter('😴 Nickerchen', fmtTime(s.time), 'Prognose');
    }
    return;
  }

  if (m.isToday) {
    if (pred.status === 'asleep') {
      center.dataset.mode = 'active'; center.dataset.start = new Date(pred.active.start).toISOString();
      setCenter(pred.sleepType === 'night' ? '🌙 Schläft (Nacht)' : '😴 Schläft', elapsed(new Date(pred.active.start)),
        pred.prediction ? `ca. bis ${fmtClock(pred.prediction.time)}` : '');
    } else if (pred.prediction && pred.prediction.kind === 'sleep') {
      const p = pred.prediction;
      const stale = pred.lastWake && new Date(pred.lastWake) < startOfDayLocal(new Date());
      if (stale) {
        // Neuer Tag, heute noch nichts getrackt -> freundlicher Hinweis statt "12h überfällig"
        setCenter('☀️ Neuer Tag', '–', 'Noch nichts getrackt – unten starten');
      } else {
        center.dataset.mode = 'next'; center.dataset.target = p.time.toISOString();
        setCenter(p.type === 'night' ? '🌙 Schlafenszeit' : '😴 Nächstes Nickerchen', fmtTime(p.time), '');
        updateHomeTick();
      }
    } else {
      setCenter('☀️ Wach', '–', '');
    }
  } else {
    const napMin = m.naps.filter((n) => n.end).reduce((a, n) => a + (new Date(n.end) - new Date(n.start)) / 60000, 0);
    const nightTxt = m.nightStart && m.nightStart.end
      ? ` · Nacht ${fmtDuration(Math.round((new Date(m.nightStart.end) - new Date(m.nightStart.start)) / 60000))}` : '';
    setCenter('Tagesschlaf', napMin ? fmtShort(Math.round(napMin)) : '–', `${m.naps.length} Nickerchen${nightTxt}`, true);
  }
}

function renderTracker(state, pred) {
  const el = $('tracker');
  el.innerHTML = '';
  delete el.dataset.start; delete el.dataset.target;
  if (!sameDayLocal(selectedDay, new Date())) { el.hidden = true; return; }
  el.hidden = false;
  const active = state.sessions.find((s) => !s.end);
  if (active) {
    const start = new Date(active.start);
    const isNight = active.type === 'night';
    const target = pred.prediction && pred.prediction.kind === 'wake' ? new Date(pred.prediction.time) : null;
    const bar = document.createElement('div');
    bar.className = 'timer-bar';
    bar.innerHTML = `
      <div class="tb-row">
        <span>${isNight ? '🌙' : '😴'} ${isNight ? 'Nacht' : 'Nickerchen'} läuft</span>
        <span class="tb-time" id="tb-time">${elapsed(start)}</span>
      </div>
      <div class="tb-track"><div class="tb-fill" id="tb-fill"></div></div>
      <div class="tb-sub">seit ${fmtClock(start)}${target ? ` · ca. bis ${fmtClock(target)}` : ''}</div>`;
    el.appendChild(bar);
    el.dataset.start = start.toISOString();
    if (target) el.dataset.target = target.toISOString();
    el.appendChild(bigBtn(isNight ? '🌅 Aufgewacht (Nacht beenden)' : '⏹ Nickerchen beenden', () => {
      const s = store.stop(); vibrate(); render();
      toast('Aufgewacht — gut geschlafen! 👶', () => { store.updateSession(s.id, { end: null }); render(); });
    }));
  } else {
    el.appendChild(bigBtn('😴 Nickerchen starten', () => {
      const s = store.start('nap'); vibrate(); render();
      toast('Nickerchen gestartet', () => { store.removeSession(s.id); render(); });
    }));
    const night = document.createElement('button');
    night.className = 'btn btn-ghost btn-block';
    night.textContent = '🌙 Schlafenszeit (Nacht) starten';
    night.onclick = () => {
      const s = store.start('night'); vibrate(); render();
      toast('Gute Nacht! 🌙', () => { store.removeSession(s.id); render(); });
    };
    el.appendChild(night);
    el.appendChild(quickChips([10, 20, 30], (min) => {
      const s = store.start('nap', new Date(Date.now() - min * 60000)); vibrate(); render();
      toast(`Nickerchen vor ${min} Min gestartet`, () => { store.removeSession(s.id); render(); });
    }, 'eingeschlafen vor'));
  }
}

function renderTodayList(state) {
  $('today-title').textContent = sameDayLocal(selectedDay, new Date())
    ? 'Heute' : selectedDay.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const list = $('today-list');
  list.innerHTML = '';
  const items = state.sessions.filter((s) =>
    (s.type === 'nap' && sameDayLocal(new Date(s.start), selectedDay))
    || (s.type === 'night' && (sameDayLocal(new Date(s.start), selectedDay) || (s.end && sameDayLocal(new Date(s.end), selectedDay))))
  ).sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!items.length) { list.innerHTML = '<li class="today-empty">Noch nichts getrackt.</li>'; return; }
  for (const s of items) {
    const li = document.createElement('li');
    li.className = 'history-item';
    const icon = s.type === 'night' ? '🌙' : '😴';
    const label = s.type === 'night' ? 'Nacht' : 'Nickerchen';
    let txt;
    if (s.end) {
      const mins = Math.round((new Date(s.end) - new Date(s.start)) / 60000);
      txt = `${fmtTime(s.start)}–${fmtTime(s.end)} · ${fmtDuration(mins)}`;
    } else txt = `${fmtTime(s.start)} · läuft …`;
    li.innerHTML = `
      <span class="hi-icon">${icon}</span>
      <div class="hi-body"><div class="hi-title">${label}</div><div class="hi-sub">${txt}</div></div>
      <button class="icon-btn hi-edit" aria-label="Bearbeiten">✎</button>`;
    li.querySelector('.hi-edit').onclick = () => openManual(s);
    list.appendChild(li);
  }
}

function updateArc() {
  const arc = $('clock-arc');
  if (!arc || !arcWake || !arcBed) return;
  if (!arcIsToday) { arc.setAttribute('d', clkArc(0, 1)); return; }
  const span = arcBed - arcWake;
  arc.setAttribute('d', clkArc(0, Math.max(0, Math.min(1, (Date.now() - arcWake) / span))));
}

// Live-Aktualisierung (jede Sekunde)
function updateHomeTick() {
  const center = $('clock-center');
  if (center) {
    const mode = center.dataset.mode;
    if (mode === 'active' && center.dataset.start) {
      $('cc-time').textContent = elapsed(new Date(center.dataset.start));
    } else if (mode === 'next' && center.dataset.target) {
      const diff = new Date(center.dataset.target) - new Date();
      if (diff <= 0) { center.classList.add('overdue'); $('cc-sub').textContent = `⚠️ ${fmtDuration(Math.round(-diff / 60000))} überfällig`; }
      else { center.classList.remove('overdue'); $('cc-sub').textContent = `in ${fmtDuration(Math.round(diff / 60000))}`; }
    }
  }
  const tr = $('tracker');
  if (tr && tr.dataset.start) {
    const t = document.getElementById('tb-time');
    if (t) t.textContent = elapsed(new Date(tr.dataset.start));
    const fill = document.getElementById('tb-fill');
    if (fill && tr.dataset.target) {
      const total = new Date(tr.dataset.target) - new Date(tr.dataset.start);
      fill.style.width = (Math.max(0, Math.min(1, (Date.now() - new Date(tr.dataset.start)) / total)) * 100).toFixed(1) + '%';
    }
  }
  updateArc();
}


function bigBtn(label, onclick) {
  const b = document.createElement('button');
  b.className = 'btn btn-primary btn-block btn-big';
  b.textContent = label;
  b.onclick = onclick;
  return b;
}
function quickChips(mins, handler, prefix) {
  const wrap = document.createElement('div');
  wrap.className = 'quick-chips';
  mins.forEach((m) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = `${prefix} ${m} Min`;
    c.onclick = () => handler(m);
    wrap.appendChild(c);
  });
  return wrap;
}


// ---------------------------------------------------------------------------
//  Tages-Übersicht & 7-Tage-Trend
// ---------------------------------------------------------------------------
function fmtShort(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h}:${pad(m)} Std` : `${h} Std`) : `${m} Min`;
}
function cmpClass(actual, typ, tol) {
  const t = tol == null ? Math.round(typ * 0.15) : tol;
  return actual >= typ - t ? 'ok' : 'low';
}
function tile(val, lbl, cmp, cls) {
  return `<div class="s-tile"><div class="s-val">${val}</div><div class="s-lbl">${lbl}</div><div class="s-cmp ${cls}">${cmp}</div></div>`;
}

function renderSummary(state) {
  const card = $('summary-card');
  const sum = daySummary(state.sessions, state.baby.birthDate);
  card.hidden = false;
  $('summary-tiles').innerHTML = [
    tile(`${sum.naps}×`, 'Nickerchen', `typ. ${sum.typical.naps}×`, cmpClass(sum.naps, sum.typical.naps, 0)),
    tile(fmtShort(sum.napMinutes), 'Tagschlaf', `typ. ${fmtShort(sum.typical.napMinutes)}`, cmpClass(sum.napMinutes, sum.typical.napMinutes)),
    sum.nightMinutes
      ? tile(fmtShort(sum.totalMinutes), 'Gesamt 24h', `typ. ${fmtShort(sum.typical.totalMinutes)}`, cmpClass(sum.totalMinutes, sum.typical.totalMinutes))
      : tile('–', 'Gesamt 24h', 'Nacht fehlt', ''),
  ].join('');
  $('summary-hint').textContent = sum.nightMinutes
    ? `Letzte Nacht: ${fmtDuration(sum.nightMinutes)}.`
    : 'Letzte Nacht noch nicht erfasst.';
}

function renderTrends(state) {
  const card = $('trend-card');
  const data = weeklyTrend(state.sessions);
  if (!data.some((d) => d.napMin + d.nightMin > 0)) { card.hidden = true; return; }
  card.hidden = false;
  const maxTotal = Math.max(1, ...data.map((d) => d.napMin + d.nightMin));
  const todayIdx = data.length - 1;
  const chart = $('trend-chart');
  chart.innerHTML = '';
  data.forEach((d, i) => {
    const total = d.napMin + d.nightMin;
    const barPx = Math.round((total / maxTotal) * 100);
    const col = document.createElement('div');
    col.className = 'tc-col' + (i === todayIdx ? ' is-today' : '');
    const totalTxt = total ? (total / 60).toFixed(1).replace('.', ',') : '';
    col.innerHTML = `
      <div class="tc-total">${totalTxt}</div>
      <div class="tc-bar" style="height:${Math.max(2, barPx)}px" title="${d.label}: ${fmtDuration(total)} (Nacht ${fmtDuration(d.nightMin)}, Nickerchen ${fmtDuration(d.napMin)})">
        <div class="tc-seg seg-nap" style="height:${total ? (d.napMin / total) * 100 : 0}%"></div>
        <div class="tc-seg seg-night" style="height:${total ? (d.nightMin / total) * 100 : 0}%"></div>
      </div>
      <div class="tc-lbl">${d.label}</div>`;
    chart.appendChild(col);
  });
  const recent = weeklyTrend(state.sessions, new Date(), 14).filter((d) => d.napCount > 0);
  const ones = recent.filter((d) => d.napCount === 1).length;
  const twos = recent.filter((d) => d.napCount >= 2).length;
  const hint = $('trend-hint');
  if (ones >= 2 && twos >= 2) {
    const avg = recent.reduce((a, d) => a + d.napCount, 0) / recent.length;
    hint.hidden = false;
    hint.textContent = `👶 Miray ist im Übergang von 2 auf 1 Nickerchen (Ø ${avg.toFixed(1).replace('.', ',')}/Tag, ${ones}× ein, ${twos}× zwei).`;
  } else {
    hint.hidden = true;
  }
}

function renderShift(state) {
  const el = $('shift-banner');
  const sh = detectShift(state.sessions);
  const map = {
    longer: ['sh-longer', `📈 Wachfenster werden länger (Ø +${Math.abs(sh.deltaMin || 0)} Min) – Miray entwickelt sich weiter. Die Prognose zieht automatisch mit.`],
    shorter: ['sh-shorter', `📉 Wachfenster zuletzt kürzer (Ø ${sh.deltaMin || 0} Min) – evtl. Schlafregression oder Übermüdung. Etwas früher hinlegen kann helfen.`],
    dropnap: ['sh-dropnap', '🔄 Zuletzt weniger Nickerchen – vermutlich der Übergang von 2 auf 1.'],
  };
  if (sh.type !== 'none' && map[sh.type]) {
    el.hidden = false;
    el.className = 'shift-banner ' + map[sh.type][0];
    el.textContent = map[sh.type][1];
  } else {
    el.hidden = true;
  }
}

function renderReview(state) {
  const card = $('review-card');
  const r = predictionReview(state.sessions, state.baby.birthDate);
  if (!r) { card.hidden = true; return; }
  card.hidden = false;
  $('review-stats').innerHTML = [
    tile(`±${r.avgAbs}`, 'Ø Abweichung (Min)', '', ''),
    tile(`${r.within30}%`, 'im ±30-Min-Fenster', '', r.within30 >= 50 ? 'ok' : 'low'),
    tile(`${r.avgSigned >= 0 ? '+' : ''}${r.avgSigned}`, 'Tendenz (Min)', r.avgSigned >= 0 ? 'später' : 'früher', ''),
  ].join('');
  const chart = $('review-chart');
  chart.innerHTML = '';
  const maxDev = Math.max(30, ...r.items.map((i) => Math.abs(i.devMin)));
  r.items.forEach((it) => {
    const col = document.createElement('div');
    col.className = 'rv-col';
    const bar = document.createElement('div');
    bar.className = 'rv-bar ' + (it.devMin >= 0 ? 'later' : 'early');
    bar.style.height = Math.round(Math.min(1, Math.abs(it.devMin) / maxDev) * 44) + 'px';
    bar.title = `${fmtTime(it.onset)}: ${it.devMin >= 0 ? '+' : ''}${it.devMin} Min`;
    col.appendChild(bar);
    chart.appendChild(col);
  });
  $('review-hint').textContent = `Letzte ${r.count} Nickerchen: Vorhersage vs. tatsächlich. Oben = später als vorhergesagt (gelb), unten = früher (blau).`;
}

function renderHeatmap(state) {
  const card = $('heat-card');
  const days = weeklyTrend(state.sessions, new Date(), 42); // 6 Wochen
  if (!days.some((d) => d.napMin + d.nightMin > 0)) { card.hidden = true; return; }
  card.hidden = false;
  const grid = $('heat-grid');
  grid.innerHTML = '';
  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((d) => {
    const h = document.createElement('div'); h.className = 'heat-dow'; h.textContent = d; grid.appendChild(h);
  });
  const offset = (days[0].date.getDay() + 6) % 7; // Montag = 0
  for (let i = 0; i < offset; i++) {
    const e = document.createElement('div'); e.className = 'heat-cell empty'; grid.appendChild(e);
  }
  days.forEach((d) => {
    const total = d.napMin + d.nightMin;
    const lvl = total === 0 ? 0 : total < 600 ? 1 : total < 720 ? 2 : total < 840 ? 3 : 4;
    const cell = document.createElement('div');
    cell.className = 'heat-cell h' + lvl;
    cell.textContent = d.date.getDate();
    cell.title = `${d.date.toLocaleDateString('de-DE')}: ${total ? fmtDuration(total) : 'keine Daten'}`;
    grid.appendChild(cell);
  });
  const colors = ['#3a2f6b', '#5243a0', '#6f5cc9', '#9f8dff'];
  $('heat-legend').innerHTML = 'wenig ' + colors.map((c) => `<span class="hl-box" style="background:${c}"></span>`).join('') + ' viel · Gesamtschlaf/Tag';
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
//  Live-Timer (Startseite jede Sekunde aktualisieren)
// ---------------------------------------------------------------------------
function tickTimer() {
  updateHomeTick();
}

// ---------------------------------------------------------------------------
//  Event-Bindung
// ---------------------------------------------------------------------------
export function bindEvents() {
  // Startseite
  $('today-add').onclick = () => openManual(null);

  // Einstellungen
  $('settings-btn').onclick = () => {
    $('sync-code').value = store.getFamilyCode() || '';
    updateSyncUI(store.syncConnected() ? 'connected' : 'disconnected');
    updateNotifyUI();
    $('settings').hidden = false;
  };

  // ---- Erinnerungen ----
  $('notify-enable').onclick = async () => {
    const ok = await notify.enableNotifications();
    updateNotifyUI();
    toast(ok ? 'Erinnerungen aktiviert 🔔' : 'Benachrichtigungen wurden abgelehnt');
    if (ok) render(); // sofort für die aktuelle Prognose planen
  };
  $('notify-disable').onclick = () => {
    notify.disableNotifications();
    updateNotifyUI();
    toast('Erinnerungen ausgeschaltet');
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

  $('report-btn').onclick = () => { $('settings').hidden = true; buildReport(); };

  $('clear-btn').onclick = () => {
    if (confirm('Live getrackte Einträge zurücksetzen und Mirays Startdaten neu laden?')) {
      store.resetToSeed();
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

  // ---- Nacht-/Dimm-Modus (+ Bildschirm wachhalten) ----
  let wakeLock = null;
  async function acquireWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
  }
  function releaseWakeLock() { try { if (wakeLock) wakeLock.release(); } catch { /* ignore */ } wakeLock = null; }
  function setDim(on) {
    document.body.classList.toggle('dim', on);
    let exit = document.getElementById('dim-exit-btn');
    if (on) {
      acquireWakeLock();
      if (!exit) {
        exit = document.createElement('button');
        exit.id = 'dim-exit-btn';
        exit.className = 'dim-exit';
        exit.textContent = '☀️ Nachtmodus beenden';
        exit.onclick = () => setDim(false);
        document.body.appendChild(exit);
      }
      exit.hidden = false;
    } else {
      releaseWakeLock();
      if (exit) exit.hidden = true;
    }
  }
  $('dim-btn').onclick = () => setDim(!document.body.classList.contains('dim'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.body.classList.contains('dim')) acquireWakeLock();
  });

  // ---- Installations-Hinweis (Zum Startbildschirm hinzufügen) ----
  const INSTALL_KEY = 'babysleep.installDismissed';
  let deferredPrompt = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let dismissed = false;
  try { dismissed = localStorage.getItem(INSTALL_KEY) === '1'; } catch { /* ignore */ }
  const showInstall = (text, withBtn) => {
    if (standalone || dismissed) return;
    $('install-text').textContent = text;
    $('install-btn').hidden = !withBtn;
    $('install-banner').hidden = false;
  };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall('📲 Zum Startbildschirm hinzufügen für den App-Start.', true);
  });
  $('install-btn').onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('install-banner').hidden = true;
  };
  $('install-dismiss').onclick = () => {
    try { localStorage.setItem(INSTALL_KEY, '1'); } catch { /* ignore */ }
    $('install-banner').hidden = true;
  };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone && !dismissed) {
    showInstall('📲 Installieren: „Teilen" → „Zum Home-Bildschirm".', false);
  }

  // Live-Timer & periodisches Neurendern der Vorhersagen
  setInterval(tickTimer, 1000);
  setInterval(render, 60000); // Vorhersagen jede Minute frisch berechnen
  // Neu rendern, wenn App wieder in den Vordergrund kommt
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}
