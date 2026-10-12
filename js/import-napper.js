// ============================================================================
//  Napper-CSV-Import — wandelt einen Napper-Logexport in Schlummer-Sessions um.
// ----------------------------------------------------------------------------
//  Abbildung:
//    NAP (Start/Ende)              -> Nickerchen   (type 'nap')
//    BED_TIME -> naechstes WOKE_UP -> Nachtschlaf  (type 'night')
//    Alte "Nacht-als-NAP"-Eintraege (lang / nachts) werden als Nacht erkannt.
//    NIGHT_WAKING, WOKE_UP, Stillen/Flasche/Wickeln -> ignoriert.
//
//  Reiner Parser ohne DOM/Store-Abhaengigkeit, damit er testbar bleibt.
// ============================================================================

const MIN = 60000;
const HOUR = 3600000;

// Nur die ersten drei Spalten (start,end,category) sind fuer uns relevant und
// enthalten nie Kommas -> einfaches Splitten ist sicher, egal was dahinter steht.
function firstThree(line) {
  const a = line.indexOf(',');
  const b = line.indexOf(',', a + 1);
  const c = line.indexOf(',', b + 1);
  if (a < 0 || b < 0) return null;
  const end = c < 0 ? line.length : c;
  return [line.slice(0, a), line.slice(a + 1, b), line.slice(b + 1, end)];
}

function nocturnal(d) {
  const h = d.getHours();
  return h >= 19 || h < 5;
}

export function parseNapperCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines[0].toLowerCase().startsWith('start,end,category')) lines.shift();

  // Erst alle Roh-Ereignisse einsammeln
  const naps = [];     // {start:Date, end:Date}
  const bedtimes = [];
  const wakeups = [];
  for (const line of lines) {
    const cols = firstThree(line);
    if (!cols) continue;
    const [s, e, cat] = cols;
    const start = s ? new Date(s) : null;
    if (!start || isNaN(start)) continue;
    if (cat === 'NAP') {
      const end = e ? new Date(e) : null;
      if (end && !isNaN(end) && end > start) naps.push({ start, end });
    } else if (cat === 'BED_TIME') {
      bedtimes.push(start);
    } else if (cat === 'WOKE_UP') {
      wakeups.push(start);
    }
  }

  // 1) Naechte aus BED_TIME -> naechstes WOKE_UP (3–16 Std)
  const nights = [];
  wakeups.sort((a, b) => a - b);
  for (const bt of bedtimes) {
    const wu = wakeups.find((w) => w > bt && (w - bt) <= 16 * HOUR);
    if (wu && (wu - bt) >= 3 * HOUR) nights.push({ start: bt, end: wu });
  }

  const inNight = (d) => nights.some((n) => d >= n.start && d <= n.end);

  // 2) NAP-Eintraege einordnen
  const sessions = [];
  let skipped = 0;
  for (const nap of naps) {
    const dur = (nap.end - nap.start) / MIN;
    if (dur < 5 || dur > 1200) { skipped++; continue; }
    if (inNight(nap.start)) { skipped++; continue; } // liegt in einer Nacht -> kein separates Nickerchen
    if (dur >= 240 || nocturnal(nap.start)) {
      // Alte Schreibweise: Nacht wurde als (langes/naechtliches) NAP erfasst
      sessions.push({ type: 'night', start: nap.start.toISOString(), end: nap.end.toISOString() });
      nights.push({ start: nap.start, end: nap.end });
    } else {
      sessions.push({ type: 'nap', start: nap.start.toISOString(), end: nap.end.toISOString() });
    }
  }
  for (const n of nights) {
    // Nur die aus BED_TIME gebauten Naechte ergaenzen (die NAP-Naechte sind schon drin)
    if (sessions.some((s) => s.type === 'night' && s.start === n.start.toISOString())) continue;
    sessions.push({ type: 'night', start: n.start.toISOString(), end: n.end.toISOString() });
  }

  sessions.sort((a, b) => new Date(a.start) - new Date(b.start));
  const napCount = sessions.filter((s) => s.type === 'nap').length;
  const nightCount = sessions.filter((s) => s.type === 'night').length;
  return {
    sessions,
    stats: {
      total: sessions.length,
      naps: napCount,
      nights: nightCount,
      skipped,
      from: sessions.length ? sessions[0].start.slice(0, 10) : null,
      to: sessions.length ? sessions[sessions.length - 1].start.slice(0, 10) : null,
    },
  };
}
