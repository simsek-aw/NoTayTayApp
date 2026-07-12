// ============================================================================
//  Schlaf-Engine — Vorhersage von Nickerchen & Schlafenszeit
// ============================================================================
//  Ansatz: "Wachfenster" (wake windows). Das ist die Methode, die auch Apps
//  wie Napper oder Huckleberry nutzen. Ein Baby kann altersabhängig nur eine
//  gewisse Zeit wach bleiben, bevor es wieder müde wird. Aus dieser Zeitspanne
//  plus dem letzten Aufwachzeitpunkt ergibt sich der nächste Schlaf.
//
//  Für maximale Genauigkeit wird die reine Alters-Faustregel mit den ECHTEN
//  getrackten Daten des Babys kombiniert ("personalisiert"). Je mehr Daten
//  vorliegen, desto stärker zählt das individuelle Muster.
// ============================================================================

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// ---------------------------------------------------------------------------
//  Altersbasierte Referenzwerte (pädiatrische Schlafforschung)
//  wwMin/wwMax  : Spanne der Wachfenster in Minuten (Tagesverlauf: kurz -> lang)
//  wwBed        : Wachfenster vor der Nacht (typ. das längste des Tages)
//  naps         : typische Anzahl Nickerchen pro Tag
//  napDur       : typische Nickerchen-Dauer (Minuten)
//  nightHrs     : typische Nachtschlafdauer (Stunden)
// ---------------------------------------------------------------------------
const AGE_TABLE = [
  { maxDays: 28,   label: '0–1 Monat',    wwMin: 40,  wwMax: 60,  wwBed: 60,  naps: 5, napDur: 50,  nightHrs: 9  },
  { maxDays: 56,   label: '1–2 Monate',   wwMin: 45,  wwMax: 75,  wwBed: 75,  naps: 5, napDur: 55,  nightHrs: 9.5 },
  { maxDays: 84,   label: '2–3 Monate',   wwMin: 60,  wwMax: 90,  wwBed: 90,  naps: 4, napDur: 60,  nightHrs: 10 },
  { maxDays: 112,  label: '3–4 Monate',   wwMin: 75,  wwMax: 105, wwBed: 110, naps: 4, napDur: 60,  nightHrs: 10.5 },
  { maxDays: 140,  label: '4–5 Monate',   wwMin: 90,  wwMax: 120, wwBed: 135, naps: 3, napDur: 70,  nightHrs: 11 },
  { maxDays: 182,  label: '5–6 Monate',   wwMin: 105, wwMax: 140, wwBed: 150, naps: 3, napDur: 75,  nightHrs: 11 },
  { maxDays: 213,  label: '6–7 Monate',   wwMin: 120, wwMax: 160, wwBed: 165, naps: 3, napDur: 80,  nightHrs: 11 },
  { maxDays: 274,  label: '7–9 Monate',   wwMin: 150, wwMax: 180, wwBed: 190, naps: 2, napDur: 90,  nightHrs: 11 },
  { maxDays: 365,  label: '9–12 Monate',  wwMin: 165, wwMax: 210, wwBed: 220, naps: 2, napDur: 85,  nightHrs: 11 },
  { maxDays: 456,  label: '12–15 Monate', wwMin: 210, wwMax: 255, wwBed: 270, naps: 1, napDur: 120, nightHrs: 11 },
  { maxDays: 548,  label: '15–18 Monate', wwMin: 255, wwMax: 300, wwBed: 315, naps: 1, napDur: 120, nightHrs: 11 },
  { maxDays: 730,  label: '18–24 Monate', wwMin: 300, wwMax: 330, wwBed: 345, naps: 1, napDur: 110, nightHrs: 11 },
  { maxDays: Infinity, label: '2+ Jahre', wwMin: 300, wwMax: 360, wwBed: 360, naps: 1, napDur: 100, nightHrs: 11 },
];

export function ageInDays(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  return Math.max(0, Math.floor((now - b) / (24 * HOUR)));
}

export function ageProfile(birthDate, now = new Date()) {
  const days = ageInDays(birthDate, now);
  if (days == null) return AGE_TABLE[4]; // sinnvoller Default (~4 Mon.)
  return AGE_TABLE.find((r) => days <= r.maxDays) || AGE_TABLE[AGE_TABLE.length - 1];
}

// ---------------------------------------------------------------------------
//  Erwartete Wachfenster pro Position im Tagesverlauf (rein altersbasiert).
//  Das erste Wachfenster am Morgen ist am kürzesten, das vor der Nacht am
//  längsten. Dazwischen wird linear interpoliert.
//  Rückgabe: Array mit (naps) Nickerchen-Wachfenstern + 1 Nacht-Wachfenster.
// ---------------------------------------------------------------------------
function baselineWakeWindows(prof, napCount) {
  const n = Math.max(1, napCount);          // Anzahl Nickerchen
  const windows = [];
  for (let i = 0; i < n; i++) {
    // Interpolation zwischen wwMin (erstes) und wwMax (letztes Nickerchen)
    const t = n === 1 ? 0 : i / (n - 1);
    windows.push(Math.round(prof.wwMin + (prof.wwMax - prof.wwMin) * t));
  }
  windows.push(prof.wwBed);                  // Wachfenster vor der Nacht
  return windows;                            // Länge = napCount + 1
}

// ---------------------------------------------------------------------------
//  Historische Auswertung: Sessions in Tageszyklen gruppieren.
//  Ein Zyklus = vom Ende eines Nachtschlafs bis zum nächsten Nachtschlaf.
//  Pro Zyklus werden die tatsächlichen Wachfenster (Position 0,1,2,…) und
//  Nickerchen-Dauern erfasst.
// ---------------------------------------------------------------------------
export function buildCycles(sessions) {
  const done = sessions
    .filter((s) => s.end)
    .slice()
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const cycles = [];
  let current = null;

  for (const s of done) {
    const start = new Date(s.start);
    const end = new Date(s.end);
    if (s.type === 'nap') {
      if (!current) current = { naps: [], wakeWindows: [] };
      // Wachfenster vor diesem Nickerchen = Start - Ende des vorherigen Schlafs
      if (current._lastWake) {
        const ww = (start - current._lastWake) / MIN;
        if (ww > 0 && ww < 12 * 60) current.wakeWindows.push(Math.round(ww));
      }
      current.naps.push({ start, end, dur: Math.round((end - start) / MIN) });
      current._lastWake = end;
    } else if (s.type === 'night') {
      // Nacht beendet den laufenden Zyklus
      if (current) {
        if (current._lastWake) {
          const ww = (start - current._lastWake) / MIN; // letztes WW vor Nacht
          if (ww > 0 && ww < 12 * 60) current.bedtimeWindow = Math.round(ww);
        }
        current.nightStart = start;
        cycles.push(current);
      }
      // neuer Zyklus beginnt beim Aufwachen aus der Nacht
      current = { naps: [], wakeWindows: [], morningWake: end, _lastWake: end };
    }
  }
  if (current && current.naps.length) cycles.push(current);
  return cycles;
}

// Mittelwert eines Arrays mit AKTUALITÄTS-/TREND-Gewichtung.
// Werte sind chronologisch (ältester zuerst). Neuere Tage werden exponentiell
// stärker gewichtet – so folgt die Prognose automatisch dem Trend (z. B. länger
// werdende Wachfenster bei Wachstum), statt alte Tage gleich stark zu zählen.
function weightedMean(values) {
  if (!values.length) return null;
  const base = 1.6; // >1 = neuere Werte dominieren
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    const w = Math.pow(base, i);
    num += v * w;
    den += w;
  });
  return num / den;
}

// ---------------------------------------------------------------------------
//  Personalisierte Wachfenster: Alters-Baseline mit historischen Ist-Werten
//  mischen. Gewicht der Historie steigt mit der Anzahl vorhandener Messwerte.
// ---------------------------------------------------------------------------
export function personalizedWakeWindows(sessions, prof, napTarget) {
  const cycles = buildCycles(sessions);
  const base = baselineWakeWindows(prof, napTarget);

  // Ist-Wachfenster pro Position aus letzten (bis zu 14) Zyklen sammeln
  const recent = cycles.slice(-14);
  const perPos = base.map(() => []);
  for (const c of recent) {
    c.wakeWindows.forEach((ww, i) => { if (i < perPos.length - 1) perPos[i].push(ww); });
    if (c.bedtimeWindow != null) perPos[perPos.length - 1].push(c.bedtimeWindow);
  }

  const windows = base.map((baseVal, i) => {
    const samples = perPos[i];
    const hist = weightedMean(samples);
    if (hist == null) return { minutes: baseVal, samples: 0 };
    // Gewicht: 0 Proben -> 0 %, 4+ Proben -> ~80 % Historie
    const w = Math.min(0.8, samples.length * 0.2);
    const blended = Math.round(hist * w + baseVal * (1 - w));
    return { minutes: blended, samples: samples.length };
  });
  return windows;
}

// Erwartete Nickerchen-Dauer pro Position (Historie + Alters-Baseline)
export function personalizedNapDurations(sessions, prof, napTarget) {
  const cycles = buildCycles(sessions).slice(-14);
  const perPos = Array.from({ length: napTarget }, () => []);
  for (const c of cycles) {
    c.naps.forEach((nap, i) => { if (i < napTarget) perPos[i].push(nap.dur); });
  }
  return perPos.map((samples) => {
    const hist = weightedMean(samples);
    if (hist == null) return { minutes: prof.napDur, samples: 0 };
    const w = Math.min(0.8, samples.length * 0.2);
    return { minutes: Math.round(hist * w + prof.napDur * (1 - w)), samples: samples.length };
  });
}

// Durchschnittliche Anzahl Nickerchen aus abgeschlossenen Zyklen
function historicalNapCount(sessions, prof) {
  const cycles = buildCycles(sessions).filter((c) => c.nightStart); // nur vollständige Tage
  const recent = cycles.slice(-10);
  if (recent.length < 2) return prof.naps;
  const avg = recent.reduce((s, c) => s + c.naps.length, 0) / recent.length;
  return Math.max(1, Math.round(avg));
}

// ---------------------------------------------------------------------------
//  Zyklus-Beginn (letztes Aufwachen aus der Nacht) bestimmen
// ---------------------------------------------------------------------------
function currentCycleStart(sessions, now) {
  const nights = sessions
    .filter((s) => s.type === 'night' && s.end && new Date(s.end) <= now)
    .sort((a, b) => new Date(a.end) - new Date(b.end));
  if (nights.length) return new Date(nights[nights.length - 1].end);
  // Fallback: Beginn des heutigen Tages
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function confidenceFrom(samples) {
  if (samples >= 3) return 'hoch';
  if (samples >= 1) return 'mittel';
  return 'niedrig';
}

// ---------------------------------------------------------------------------
//  HAUPT-VORHERSAGE
// ---------------------------------------------------------------------------
export function predict(sessions, birthDate, now = new Date()) {
  const prof = ageProfile(birthDate, now);
  const napTarget = historicalNapCount(sessions, prof);
  const windows = personalizedWakeWindows(sessions, prof, napTarget);
  const napDurs = personalizedNapDurations(sessions, prof, napTarget);

  const active = sessions.find((s) => !s.end);
  const cycleStart = currentCycleStart(sessions, now);

  // Bereits abgeschlossene Nickerchen im aktuellen Zyklus
  const napsToday = sessions.filter(
    (s) => s.type === 'nap' && s.end && new Date(s.start) >= cycleStart
  ).length;

  const result = {
    profile: prof,
    napTarget,
    napsToday,
    ageDays: ageInDays(birthDate, now),
    windows,
    active: active || null,
  };

  // ---- Baby schläft gerade -> Aufwachzeit vorhersagen -------------------
  if (active) {
    const start = new Date(active.start);
    if (active.type === 'night') {
      const wake = new Date(start.getTime() + prof.nightHrs * HOUR);
      result.status = 'asleep';
      result.sleepType = 'night';
      result.prediction = {
        kind: 'wake',
        time: wake,
        rangeStart: new Date(wake.getTime() - 45 * MIN),
        rangeEnd: new Date(wake.getTime() + 45 * MIN),
        confidence: 'mittel',
        label: 'Voraussichtliches Aufwachen',
      };
    } else {
      const idx = Math.min(napsToday, napDurs.length - 1);
      const dur = napDurs[idx];
      const wake = new Date(start.getTime() + dur.minutes * MIN);
      result.status = 'asleep';
      result.sleepType = 'nap';
      result.prediction = {
        kind: 'wake',
        time: wake,
        rangeStart: new Date(wake.getTime() - 20 * MIN),
        rangeEnd: new Date(wake.getTime() + 20 * MIN),
        confidence: confidenceFrom(dur.samples),
        label: 'Voraussichtliches Aufwachen',
        napNumber: napsToday + 1,
      };
    }
    result.plan = buildPlan(now, wakeTimeOf(active, result), napsToday + (active.type === 'nap' ? 1 : 0), windows, napDurs, napTarget);
    return result;
  }

  // ---- Baby ist wach -> nächsten Schlaf vorhersagen ---------------------
  const lastSession = sessions
    .filter((s) => s.end)
    .sort((a, b) => new Date(a.end) - new Date(b.end))
    .pop();
  const lastWake = lastSession ? new Date(lastSession.end) : now;

  const wwIndex = Math.min(napsToday, windows.length - 1);
  const isNight = napsToday >= napTarget;
  const ww = windows[wwIndex];

  // Übermüdungs-Korrektur: War das zuletzt beendete Nickerchen deutlich zu kurz,
  // ist das Baby eher übermüdet -> nächstes Wachfenster verkürzen (früher schlafen).
  // War es besonders lang/erholsam, kann es minimal länger wach bleiben.
  let adjMinutes = ww.minutes;
  let adjustment = null;
  if (lastSession && lastSession.type === 'nap' && napsToday > 0) {
    const lastNapDur = (new Date(lastSession.end) - new Date(lastSession.start)) / MIN;
    const expected = napDurs[Math.min(napsToday - 1, napDurs.length - 1)].minutes;
    if (expected > 0) {
      const ratio = lastNapDur / expected;
      if (ratio < 0.7) { adjMinutes = Math.round(ww.minutes * 0.85); adjustment = 'short'; }
      else if (ratio > 1.3) { adjMinutes = Math.round(ww.minutes * 1.05); adjustment = 'long'; }
    }
  }
  const onset = new Date(lastWake.getTime() + adjMinutes * MIN);

  result.status = 'awake';
  result.lastWake = lastWake;
  result.prediction = {
    kind: 'sleep',
    type: isNight ? 'night' : 'nap',
    time: onset,
    rangeStart: new Date(onset.getTime() - (isNight ? 20 : 15) * MIN),
    rangeEnd: new Date(onset.getTime() + (isNight ? 20 : 15) * MIN),
    wakeWindow: adjMinutes,
    baseWakeWindow: ww.minutes,
    adjustment, // 'short' | 'long' | null
    confidence: confidenceFrom(ww.samples),
    napNumber: isNight ? null : napsToday + 1,
    label: isNight ? 'Schlafenszeit (Nacht)' : `${napsToday + 1}. Nickerchen`,
  };
  result.plan = buildPlan(lastWake, lastWake, napsToday, windows, napDurs, napTarget);
  return result;
}

function wakeTimeOf(active, result) {
  // Aufwachzeit des aktuell laufenden Schlafs (für Plan-Verkettung)
  return result.prediction ? result.prediction.time : new Date(active.start);
}

// ---------------------------------------------------------------------------
//  Tagesplan: verbleibende Schlafphasen durch Verketten von Wachfenstern und
//  Nickerchen-Dauern vorhersagen (Napper-artige Vorschau).
// ---------------------------------------------------------------------------
function buildPlan(fromWake, startWake, napsDone, windows, napDurs, napTarget) {
  const plan = [];
  let cursor = new Date(startWake);
  for (let i = napsDone; i <= napTarget; i++) {
    const ww = windows[Math.min(i, windows.length - 1)];
    const onset = new Date(cursor.getTime() + ww.minutes * MIN);
    if (i >= napTarget) {
      plan.push({ type: 'night', onset, label: 'Nacht' });
      break;
    }
    const dur = napDurs[Math.min(i, napDurs.length - 1)];
    const wake = new Date(onset.getTime() + dur.minutes * MIN);
    plan.push({ type: 'nap', onset, wake, number: i + 1, duration: dur.minutes, label: `${i + 1}. Nickerchen` });
    cursor = wake;
  }
  return plan;
}

// Kleine Helfer für die UI
export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} Std ${m} Min`;
  if (h) return `${h} Std`;
  return `${m} Min`;
}
