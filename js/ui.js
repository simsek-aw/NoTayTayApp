// ============================================================================
//  UI — Rendering & Interaktion
// ============================================================================
import { store } from './store.js';
import { predict, ageProfile, ageInDays, daySummary, weeklyTrend, predictionReview, detectShift } from './engine.js';
import * as notify from './notify.js';
import { t, getLang, setLang, locale, wkShort, ageLabel } from './i18n.js';

// Lokalisierte Dauer: "1 Std 23 Min" / "1 sa 23 dk"
function dur(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  const H = t('unit_h'); const M = t('unit_min');
  if (h && m) return `${h} ${H} ${m} ${M}`;
  if (h) return `${h} ${H}`;
  return `${m} ${M}`;
}

// Statische Texte (data-i18n / -ph / -aria) in die aktuelle Sprache setzen
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  const lb = $('lang-btn');
  if (lb) lb.textContent = getLang() === 'de' ? 'TR' : 'DE';
}


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
  const td = new Date(d);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((new Date(td.getFullYear(), td.getMonth(), td.getDate()) - startOfToday) / 86400000);
  if (diff === 0) return t('today');
  if (diff === -1) return t('yesterday');
  return td.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
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
    connecting: [t('badge_connecting'), 'badge-warn'],
    connected: [t('badge_connected'), 'badge-ok'],
    error: [t('badge_error'), 'badge-err'],
    disconnected: [t('off'), ''],
    unavailable: [t('na'), ''],
  };
  const [label, cls] = map[status] || [t('off'), ''];
  badge.textContent = label;
  badge.className = 'sync-badge ' + cls;

  const isConn = status === 'connected';
  conn.hidden = !isConn;
  setup.hidden = isConn;
  if (isConn) {
    $('sync-code-shown').textContent = store.getFamilyCode() || '';
  }
  if (status === 'error' && detail) toast(t('t_sync_err') + ': ' + detail);
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
    badge.textContent = t('na');
    badge.className = 'sync-badge';
    return;
  }
  unavailable.hidden = true;
  const on = notify.notifyEnabled();
  badge.textContent = on ? t('on') : t('off');
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
  applyI18n();

  // Kopfzeile
  $('baby-name').textContent = state.baby.name || 'Baby';
  const days = ageInDays(state.baby.birthDate);
  if (days != null) {
    const prof = ageProfile(state.baby.birthDate);
    const weeks = Math.floor(days / 7);
    const ageStr = days < 90 ? t('age_wk', { w: weeks, d: days }) : t('age_mon', { n: Math.round(days / 30.44) });
    $('baby-age').textContent = `${ageStr} · ${ageLabel(prof.label)}`;
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

  const rows = week.map((d) => `<tr><td>${d.date.toLocaleDateString(locale(), { weekday: 'short', day: '2-digit', month: '2-digit' })}</td><td>${d.napCount}×</td><td>${d.napMin ? dur(d.napMin) : '–'}</td><td>${d.nightMin ? dur(d.nightMin) : '–'}</td><td>${(d.napMin + d.nightMin) ? dur(d.napMin + d.nightMin) : '–'}</td></tr>`).join('');

  const ageStr = days < 90 ? t('rp_age_wk', { n: Math.floor(days / 7) }) : t('rp_age_mon', { n: Math.round(days / 30.44) });
  let report = document.getElementById('report');
  if (!report) { report = document.createElement('div'); report.id = 'report'; document.body.appendChild(report); }
  report.innerHTML = `
    <div class="report-actions">
      <button class="btn" id="report-print">${t('rp_print')}</button>
      <button class="btn" id="report-close">${t('rp_close')}</button>
    </div>
    <h1>${t('rp_title', { name: escapeHtml(state.baby.name) })}</h1>
    <div class="rp-sub">${t('rp_sub', { age: ageStr, date: new Date(state.baby.birthDate).toLocaleDateString(locale()), today: now.toLocaleDateString(locale()), label: ageLabel(prof.label) })}</div>
    <h2>${t('rp_avg')}</h2>
    <div class="rp-kpis">
      <div class="rp-kpi"><b>${avgNaps}</b> ${t('rp_k_naps')}</div>
      <div class="rp-kpi"><b>${avgDay ? dur(avgDay) : '–'}</b> ${t('rp_k_day')}</div>
      <div class="rp-kpi"><b>${avgNight ? dur(avgNight) : '–'}</b> ${t('rp_k_night')}</div>
      <div class="rp-kpi"><b>${avgTotal ? dur(avgTotal) : '–'}</b> ${t('rp_k_total')}</div>
    </div>
    <h2>${t('rp_table')}</h2>
    <table><thead><tr><th>${t('rp_c_day')}</th><th>${t('rp_c_naps')}</th><th>${t('rp_c_daysleep')}</th><th>${t('rp_c_night')}</th><th>${t('rp_c_total')}</th></tr></thead><tbody>${rows}</tbody></table>
    ${rev ? `<h2>${t('rp_acc_title')}</h2><p>${t('rp_acc', { a: rev.avgAbs, p: rev.within30, n: rev.count })}</p>` : ''}
    <p style="margin-top:20px;font-size:11px;color:#888;">${t('rp_foot')}</p>
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
  const wk = wkShort();
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
      setCenter(t('nap_running'), elapsed(new Date(s.start)), t('since', { t: fmtClock(s.start) }));
    } else if (s.kind === 'nap') {
      setCenter(t('c_nap'), `${fmtTime(s.start)}–${fmtTime(s.end)}`, dur(Math.round((new Date(s.end) - new Date(s.start)) / 60000)), true);
    } else if (s.kind === 'bed') {
      if (s.end) setCenter(t('c_night'), `${fmtTime(s.start)}–${fmtTime(s.end)}`, dur(Math.round((new Date(s.end) - new Date(s.start)) / 60000)), true);
      else setCenter(t('bedtime'), fmtTime(s.time), t('forecast'));
    } else if (s.kind === 'wake') {
      setCenter(t('c_wake'), fmtTime(s.time), '');
    } else {
      setCenter(t('c_nap'), fmtTime(s.time), t('forecast'));
    }
    return;
  }

  if (m.isToday) {
    if (pred.status === 'asleep') {
      center.dataset.mode = 'active'; center.dataset.start = new Date(pred.active.start).toISOString();
      setCenter(pred.sleepType === 'night' ? t('sleeping_night') : t('sleeping_nap'), elapsed(new Date(pred.active.start)),
        pred.prediction ? t('ca_until', { t: fmtClock(pred.prediction.time) }) : '');
    } else if (pred.prediction && pred.prediction.kind === 'sleep') {
      const p = pred.prediction;
      const stale = pred.lastWake && new Date(pred.lastWake) < startOfDayLocal(new Date());
      if (stale) {
        setCenter(t('newday'), '–', t('newday_sub'));
      } else {
        center.dataset.mode = 'next'; center.dataset.target = p.time.toISOString();
        setCenter(p.type === 'night' ? t('bedtime') : t('next_nap'), fmtTime(p.time), '');
        updateHomeTick();
      }
    } else {
      setCenter(t('awake'), '–', '');
    }
  } else {
    const napMin = m.naps.filter((n) => n.end).reduce((a, n) => a + (new Date(n.end) - new Date(n.start)) / 60000, 0);
    const nightTxt = m.nightStart && m.nightStart.end
      ? ` · ${t('night_d', { d: dur(Math.round((new Date(m.nightStart.end) - new Date(m.nightStart.start)) / 60000)) })}` : '';
    setCenter(t('daysleep'), napMin ? fmtShort(Math.round(napMin)) : '–', `${t('naps_n', { n: m.naps.length })}${nightTxt}`, true);
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
        <span>${isNight ? t('night_running') : t('nap_running2')}</span>
        <span class="tb-time" id="tb-time">${elapsed(start)}</span>
      </div>
      <div class="tb-track"><div class="tb-fill" id="tb-fill"></div></div>
      <div class="tb-sub">${t('since', { t: fmtClock(start) })}${target ? ` · ${t('ca_until', { t: fmtClock(target) })}` : ''}</div>`;
    el.appendChild(bar);
    el.dataset.start = start.toISOString();
    if (target) el.dataset.target = target.toISOString();
    el.appendChild(bigBtn(isNight ? t('end_night') : t('end_nap'), () => {
      const s = store.stop(); vibrate(); render();
      toast(t('t_woke'), () => { store.updateSession(s.id, { end: null }); render(); });
    }));
  } else {
    el.appendChild(bigBtn(t('start_nap'), () => {
      const s = store.start('nap'); vibrate(); render();
      toast(t('t_nap_started'), () => { store.removeSession(s.id); render(); });
    }));
    const night = document.createElement('button');
    night.className = 'btn btn-ghost btn-block';
    night.textContent = t('start_night');
    night.onclick = () => {
      const s = store.start('night'); vibrate(); render();
      toast(t('t_night'), () => { store.removeSession(s.id); render(); });
    };
    el.appendChild(night);
    el.appendChild(quickChips([10, 20, 30], (min) => {
      const s = store.start('nap', new Date(Date.now() - min * 60000)); vibrate(); render();
      toast(t('t_nap_ago', { m: min }), () => { store.removeSession(s.id); render(); });
    }, (min) => t('chip_fell', { m: min })));
  }
}

function renderTodayList(state) {
  $('today-title').textContent = sameDayLocal(selectedDay, new Date())
    ? t('today') : selectedDay.toLocaleDateString(locale(), { weekday: 'long', day: '2-digit', month: '2-digit' });
  const list = $('today-list');
  list.innerHTML = '';
  const items = state.sessions.filter((s) =>
    (s.type === 'nap' && sameDayLocal(new Date(s.start), selectedDay))
    || (s.type === 'night' && (sameDayLocal(new Date(s.start), selectedDay) || (s.end && sameDayLocal(new Date(s.end), selectedDay))))
  ).sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!items.length) { list.innerHTML = `<li class="today-empty">${t('today_empty')}</li>`; return; }
  for (const s of items) {
    const li = document.createElement('li');
    li.className = 'history-item';
    const icon = s.type === 'night' ? '🌙' : '😴';
    const label = s.type === 'night' ? t('night') : t('nap');
    let txt;
    if (s.end) {
      const mins = Math.round((new Date(s.end) - new Date(s.start)) / 60000);
      txt = `${fmtTime(s.start)}–${fmtTime(s.end)} · ${dur(mins)}`;
    } else txt = `${fmtTime(s.start)} · ${t('running')}`;
    li.innerHTML = `
      <span class="hi-icon">${icon}</span>
      <div class="hi-body"><div class="hi-title">${label}</div><div class="hi-sub">${txt}</div></div>
      <button class="icon-btn hi-edit" aria-label="${t('aria_edit')}">✎</button>`;
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
      if (diff <= 0) { center.classList.add('overdue'); $('cc-sub').textContent = t('overdue', { d: dur(Math.round(-diff / 60000)) }); }
      else { center.classList.remove('overdue'); $('cc-sub').textContent = t('in_t', { d: dur(Math.round(diff / 60000)) }); }
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
function quickChips(mins, handler, labelFn) {
  const wrap = document.createElement('div');
  wrap.className = 'quick-chips';
  mins.forEach((m) => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = labelFn(m);
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
  const H = t('unit_h'); const M = t('unit_min');
  return h ? (m ? `${h}:${pad(m)} ${H}` : `${h} ${H}`) : `${m} ${M}`;
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
    tile(`${sum.naps}×`, t('sum_naps'), t('typ', { x: `${sum.typical.naps}×` }), cmpClass(sum.naps, sum.typical.naps, 0)),
    tile(fmtShort(sum.napMinutes), t('sum_day'), t('typ', { x: fmtShort(sum.typical.napMinutes) }), cmpClass(sum.napMinutes, sum.typical.napMinutes)),
    sum.nightMinutes
      ? tile(fmtShort(sum.totalMinutes), t('sum_total'), t('typ', { x: fmtShort(sum.typical.totalMinutes) }), cmpClass(sum.totalMinutes, sum.typical.totalMinutes))
      : tile('–', t('sum_total'), t('night_missing'), ''),
  ].join('');
  $('summary-hint').textContent = sum.nightMinutes
    ? t('last_night', { d: dur(sum.nightMinutes) })
    : t('last_night_none');
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
  const wk = wkShort();
  data.forEach((d, i) => {
    const total = d.napMin + d.nightMin;
    const barPx = Math.round((total / maxTotal) * 100);
    const col = document.createElement('div');
    col.className = 'tc-col' + (i === todayIdx ? ' is-today' : '');
    const totalTxt = total ? (total / 60).toFixed(1).replace('.', ',') : '';
    const lbl = wk[d.date.getDay()];
    col.innerHTML = `
      <div class="tc-total">${totalTxt}</div>
      <div class="tc-bar" style="height:${Math.max(2, barPx)}px" title="${lbl}: ${dur(total)} (${t('legend_night')} ${dur(d.nightMin)}, ${t('legend_nap')} ${dur(d.napMin)})">
        <div class="tc-seg seg-nap" style="height:${total ? (d.napMin / total) * 100 : 0}%"></div>
        <div class="tc-seg seg-night" style="height:${total ? (d.nightMin / total) * 100 : 0}%"></div>
      </div>
      <div class="tc-lbl">${lbl}</div>`;
    chart.appendChild(col);
  });
  const recent = weeklyTrend(state.sessions, new Date(), 14).filter((d) => d.napCount > 0);
  const ones = recent.filter((d) => d.napCount === 1).length;
  const twos = recent.filter((d) => d.napCount >= 2).length;
  const hint = $('trend-hint');
  if (ones >= 2 && twos >= 2) {
    const avg = recent.reduce((a, d) => a + d.napCount, 0) / recent.length;
    hint.hidden = false;
    hint.textContent = t('transition', { avg: avg.toFixed(1).replace('.', ','), o: ones, t: twos });
  } else {
    hint.hidden = true;
  }
}

function renderShift(state) {
  const el = $('shift-banner');
  const sh = detectShift(state.sessions);
  const map = {
    longer: ['sh-longer', t('sh_longer', { d: Math.abs(sh.deltaMin || 0) })],
    shorter: ['sh-shorter', t('sh_shorter', { d: sh.deltaMin || 0 })],
    dropnap: ['sh-dropnap', t('sh_dropnap')],
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
    tile(`±${r.avgAbs}`, t('rv_dev'), '', ''),
    tile(`${r.within30}%`, t('rv_within'), '', r.within30 >= 50 ? 'ok' : 'low'),
    tile(`${r.avgSigned >= 0 ? '+' : ''}${r.avgSigned}`, t('rv_tend'), r.avgSigned >= 0 ? t('later') : t('earlier'), ''),
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
  $('review-hint').textContent = t('rv_hint', { n: r.count });
}

function renderHeatmap(state) {
  const card = $('heat-card');
  const days = weeklyTrend(state.sessions, new Date(), 42); // 6 Wochen
  if (!days.some((d) => d.napMin + d.nightMin > 0)) { card.hidden = true; return; }
  card.hidden = false;
  const grid = $('heat-grid');
  grid.innerHTML = '';
  const wk = wkShort();
  [1, 2, 3, 4, 5, 6, 0].forEach((di) => {
    const h = document.createElement('div'); h.className = 'heat-dow'; h.textContent = wk[di]; grid.appendChild(h);
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
    cell.title = `${d.date.toLocaleDateString(locale())}: ${total ? dur(total) : '–'}`;
    grid.appendChild(cell);
  });
  const colors = ['#3a2f6b', '#5243a0', '#6f5cc9', '#9f8dff'];
  const boxes = colors.map((c) => `<span class="hl-box" style="background:${c}"></span>`).join('');
  $('heat-legend').innerHTML = t('heat_legend', { boxes });
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
          <div class="tl-title">${t('nap_n', { n: item.number })}</div>
          <div class="tl-sub">${fmtClock(item.onset)} – ${fmtClock(item.wake)} · ${dur(item.duration)}</div>
        </div>`;
    } else {
      li.innerHTML = `
        <span class="tl-dot">🌙</span>
        <div class="tl-body">
          <div class="tl-title">${t('plan_bed')}</div>
          <div class="tl-sub">${t('ca_until', { t: fmtClock(item.onset) })}</div>
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
    const typeLabel = s.type === 'night' ? t('night') : t('nap');
    let durTxt = '';
    if (s.end) {
      const mins = Math.round((new Date(s.end) - start) / 60000);
      durTxt = `${fmtTime(start)}–${fmtTime(new Date(s.end))} · ${dur(mins)}`;
    } else {
      durTxt = `${fmtTime(start)} · ${t('running')}`;
    }
    li.innerHTML = `
      <span class="hi-icon">${icon}</span>
      <div class="hi-body">
        <div class="hi-title">${typeLabel}</div>
        <div class="hi-sub">${durTxt}</div>
      </div>
      <button class="icon-btn hi-edit" aria-label="${t('aria_edit')}">✎</button>`;
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
  $('manual-title').textContent = session ? t('entry_edit') : t('entry_new');
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
    toast(ok ? t('t_notify_on') : t('t_notify_denied'));
    if (ok) render(); // sofort für die aktuelle Prognose planen
  };
  $('notify-disable').onclick = () => {
    notify.disableNotifications();
    updateNotifyUI();
    toast(t('t_notify_off'));
  };

  // ---- Familien-Sync ----
  $('sync-gen').onclick = () => { $('sync-code').value = genFamilyCode(); };
  $('sync-connect').onclick = async () => {
    const code = ($('sync-code').value || '').trim().toUpperCase();
    if (code.length < 6) { toast(t('t_code_invalid')); return; }
    updateSyncUI('connecting');
    const ok = await store.connectSync(code, (status, detail) => updateSyncUI(status, detail));
    if (ok) { toast(t('t_connected')); render(); }
  };
  $('sync-copy').onclick = async () => {
    const code = store.getFamilyCode() || '';
    try { await navigator.clipboard.writeText(code); toast(t('t_copied')); }
    catch { toast(t('code_prefix') + ' ' + code); }
  };
  $('sync-disconnect').onclick = () => {
    store.disconnectSync();
    updateSyncUI('disconnected');
    toast(t('t_disconnected'));
  };
  $('settings-close').onclick = () => $('settings').hidden = true;

  $('report-btn').onclick = () => { $('settings').hidden = true; buildReport(); };

  $('clear-btn').onclick = () => {
    if (confirm(t('confirm_reset'))) {
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
    if (!start) { toast(t('t_need_start')); return; }
    if (end && new Date(end) <= new Date(start)) { toast(t('t_end_after')); return; }
    if (editingId) {
      store.updateSession(editingId, { type, start, end: end || null });
    } else {
      store.addManual({ type, start, end: end || null });
    }
    closeManual();
    render();
    toast(t('saved'));
  };
  $('man-delete').onclick = () => {
    if (editingId && confirm(t('confirm_del'))) {
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
        exit.textContent = t('dim_exit');
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
    showInstall(t('install_text'), true);
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
    showInstall(t('install_ios'), false);
  }

  // ---- Sprache umschalten (DE/TR) ----
  $('lang-btn').onclick = () => {
    setLang(getLang() === 'de' ? 'tr' : 'de');
    render();
  };

  // Live-Timer & periodisches Neurendern der Vorhersagen
  setInterval(tickTimer, 1000);
  setInterval(render, 60000); // Vorhersagen jede Minute frisch berechnen
  // Neu rendern, wenn App wieder in den Vordergrund kommt
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}
