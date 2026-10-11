// ============================================================================
//  UI — Rendering & Interaktion
// ============================================================================
import { store } from './store.js';
import { predict, ageProfile, ageInDays, fmtDuration, daySummary, weeklyTrend, predictionReview, detectShift } from './engine.js';
import * as notify from './notify.js';

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
  renderStatus(pred);
  renderActions(pred);
  renderNext(pred);
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
    $('status-sub').textContent = `eingeschlafen ${fmtClock(start)} · vor ${fmtDuration(Math.round((Date.now() - start) / 60000))}`;
  } else {
    $('status-label').textContent = '☀️ Wach';
    if (pred.lastWake) {
      $('status-timer').textContent = elapsed(pred.lastWake);
      $('status-timer').dataset.since = pred.lastWake.toISOString();
      $('status-timer').dataset.mode = 'up';
      $('status-sub').textContent = `wach seit ${fmtClock(pred.lastWake)} · vor ${fmtDuration(Math.round((Date.now() - pred.lastWake) / 60000))}`;
    } else {
      $('status-timer').textContent = '–';
      delete $('status-timer').dataset.since;
      $('status-sub').textContent = 'Noch keine Daten';
    }
  }
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

function renderActions(pred) {
  const el = $('actions');
  el.innerHTML = '';

  if (pred.status === 'asleep') {
    el.appendChild(bigBtn(pred.sleepType === 'night' ? '🌅 Aufgewacht (Nacht beenden)' : '⏹ Nickerchen beenden', () => {
      const s = store.stop();
      vibrate();
      render();
      toast('Aufgewacht — gut geschlafen! 👶', () => { store.updateSession(s.id, { end: null }); render(); });
    }));
    el.appendChild(quickChips([5, 10, 20], (min) => {
      const s = store.stop(new Date(Date.now() - min * 60000));
      vibrate();
      render();
      toast(`Aufgewacht (vor ${min} Min)`, () => { store.updateSession(s.id, { end: null }); render(); });
    }, 'aufgewacht vor'));
  } else {
    el.appendChild(bigBtn('😴 Nickerchen starten', () => {
      const s = store.start('nap');
      vibrate();
      render();
      toast('Nickerchen gestartet', () => { store.removeSession(s.id); render(); });
    }));

    const night = document.createElement('button');
    night.className = 'btn btn-ghost btn-block';
    night.textContent = '🌙 Schlafenszeit (Nacht) starten';
    night.onclick = () => {
      const s = store.start('night');
      vibrate();
      render();
      toast('Gute Nacht! 🌙', () => { store.removeSession(s.id); render(); });
    };
    el.appendChild(night);

    el.appendChild(quickChips([10, 20, 30], (min) => {
      const s = store.start('nap', new Date(Date.now() - min * 60000));
      vibrate();
      render();
      toast(`Nickerchen vor ${min} Min gestartet`, () => { store.removeSession(s.id); render(); });
    }, 'eingeschlafen vor'));
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

  const adjust = $('next-adjust');
  adjust.hidden = true;

  if (p.kind === 'wake') {
    $('next-icon').textContent = '🌅';
    $('next-time').textContent = fmtClock(p.time);
    $('next-desc').textContent = p.label + (p.napNumber ? ` · ${p.napNumber}. Nickerchen läuft` : '');
    $('next-meta').textContent = `Fenster ${fmtTime(p.rangeStart)}–${fmtTime(p.rangeEnd)} Uhr`;
    $('cd-label').textContent = 'bis zum Aufwachen';
  } else {
    $('next-icon').textContent = p.type === 'night' ? '🌙' : '😴';
    $('next-time').textContent = fmtClock(p.time);
    $('next-desc').textContent = p.label;
    $('next-meta').textContent =
      `Wachfenster ${fmtDuration(p.wakeWindow)} · ideales Fenster ${fmtTime(p.rangeStart)}–${fmtTime(p.rangeEnd)} Uhr`;
    $('cd-label').textContent = p.type === 'night' ? 'bis zur Schlafenszeit' : 'bis zum Nickerchen';

    // Hinweis auf Übermüdungs-Korrektur
    if (p.adjustment === 'short') {
      adjust.hidden = false;
      adjust.textContent = '⚡ Wachfenster verkürzt – das letzte Nickerchen war kurz.';
    } else if (p.adjustment === 'long') {
      adjust.hidden = false;
      adjust.textContent = '💤 Wachfenster etwas verlängert – das letzte Nickerchen war besonders lang.';
    }
  }

  // Live-Countdown + Wachfenster-Ring vorbereiten
  const cd = $('next-countdown');
  cd.hidden = false;
  cd.dataset.target = p.time.toISOString();

  const ring = $('ww-ring');
  const ringStart = p.kind === 'wake'
    ? (pred.active ? new Date(pred.active.start) : p.time)
    : pred.lastWake;
  ring.dataset.start = ringStart ? new Date(ringStart).toISOString() : '';
  ring.dataset.target = p.time.toISOString();
  ring.dataset.kind = p.kind; // 'sleep' (wach, zählt zum Schlaf) | 'wake' (schläft)
  $('overtired').hidden = true;

  updateCountdown();
  updateWakeWindow();

  const conf = $('confidence');
  const level = p.confidence;
  conf.textContent = `Genauigkeit: ${level}`;
  conf.className = 'confidence conf-' + (level === 'hoch' ? 'high' : level === 'mittel' ? 'mid' : 'low');
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
//  Live-Timer (Statusanzeige jede Sekunde aktualisieren)
// ---------------------------------------------------------------------------
function tickTimer() {
  const t = $('status-timer');
  if (t && t.dataset.since) {
    t.textContent = elapsed(new Date(t.dataset.since));
  }
  updateCountdown();
  updateWakeWindow();
}

// Live-Countdown bis zur nächsten Schlaf-/Aufwachzeit aktualisieren
function updateCountdown() {
  const cd = $('next-countdown');
  if (!cd || cd.hidden || !cd.dataset.target) return;
  const diff = new Date(cd.dataset.target) - new Date();
  const val = $('cd-value');
  if (diff <= 0) {
    val.textContent = 'jetzt';
    cd.classList.add('cd-now');
    return;
  }
  cd.classList.remove('cd-now');
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  val.textContent = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Wachfenster-Ring (Ampel) + Übermüdungs-Banner live aktualisieren
const RING_C = 2 * Math.PI * 44; // Umfang des Fortschritts-Kreises
function updateWakeWindow() {
  const ring = $('ww-ring');
  if (!ring || !ring.dataset.start || !ring.dataset.target) return;
  const prog = $('ww-prog');
  const over = $('overtired');
  const cd = $('next-countdown');
  const start = new Date(ring.dataset.start).getTime();
  const target = new Date(ring.dataset.target).getTime();
  const now = Date.now();
  const total = target - start;
  let frac = total > 0 ? (now - start) / total : 1;
  frac = Math.max(0, Math.min(1, frac));
  prog.style.strokeDashoffset = String(RING_C * (1 - frac));

  ring.classList.remove('ring-green', 'ring-amber', 'ring-red', 'ring-sleep');
  cd.classList.remove('cd-red');

  if (ring.dataset.kind === 'wake') {
    ring.classList.add('ring-sleep'); // Baby schläft: Fortschritt bis zum Aufwachen
    over.hidden = true;
    return;
  }
  // Baby wach: Wachfenster-Ampel grün → gelb → rot
  if (now >= target) {
    ring.classList.add('ring-red');
    cd.classList.add('cd-red');
    over.hidden = false;
    over.textContent = `⚠️ Übermüdungs-Gefahr – ideales Fenster seit ${fmtDuration(Math.round((now - target) / 60000))} überschritten.`;
  } else if (frac >= 0.8) {
    ring.classList.add('ring-amber');
    over.hidden = true;
  } else {
    ring.classList.add('ring-green');
    over.hidden = true;
  }
}

// ---------------------------------------------------------------------------
//  Event-Bindung
// ---------------------------------------------------------------------------
export function bindEvents() {
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
