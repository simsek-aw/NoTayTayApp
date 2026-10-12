// ============================================================================
//  Datenspeicher — lokale Persistenz (localStorage), keine Cloud, keine Konten.
//  Alle Daten bleiben auf dem Gerät.
// ============================================================================

import * as sync from './sync.js';
import { SEED } from './seed-data.js';

const KEY = 'babysleep.v1';
const FAMILY_KEY = 'babysleep.family'; // Familien-Code separat (nicht im Export/Sync)
const SEED_KEY = 'babysleep.seedVersion'; // welche Startdaten-Version schon geladen wurde

// Feste Baby-Konfiguration (App ist auf ein Baby ausgelegt).
const FIXED_BABY = { name: 'Miray', birthDate: '2025-11-03' };

const defaultState = {
  baby: { ...FIXED_BABY },
  sessions: [], // { id, type:'nap'|'night', start:ISO, end:ISO|null, note? }
};

let applyingRemote = false; // verhindert Rück-Push während eingehender Sync-Daten

function load() {
  let base;
  try {
    const raw = localStorage.getItem(KEY);
    base = raw ? { ...structuredClone(defaultState), ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    base = structuredClone(defaultState);
  }
  base.baby = { ...FIXED_BABY }; // Baby ist fest verdrahtet, egal was gespeichert war
  return base;
}

// Mitgelieferte Startdaten (Mirays importierte Historie) einmalig – bzw. bei
// neuer Version – lokal einspielen, ohne vorhandene (live getrackte) Einträge
// zu verlieren. Dedup über type + Startminute.
function applySeedIfNeeded(target) {
  let applied = 0;
  try { applied = parseInt(localStorage.getItem(SEED_KEY) || '0', 10) || 0; } catch { /* ignore */ }
  if (applied >= SEED.version) return false;
  const keyOf = (s) => `${s.type}|${new Date(s.start).toISOString().slice(0, 16)}`;
  const seen = new Set(target.sessions.map(keyOf));
  for (const item of SEED.sessions) {
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k);
    target.sessions.push({ id: uid(), type: item.type, start: item.start, end: item.end || null });
  }
  try { localStorage.setItem(SEED_KEY, String(SEED.version)); } catch { /* ignore */ }
  return true;
}

const listeners = new Set();
let state = load();
if (applySeedIfNeeded(state)) persist();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
  }
  listeners.forEach((fn) => fn(state));
}

function uid() {
  return 's_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export const store = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setBaby(baby) {
    state.baby = { ...state.baby, ...baby };
    persist();
    if (!applyingRemote) sync.pushBaby(state.baby);
  },

  // Aktuell laufende (nicht beendete) Session, falls vorhanden
  active() {
    return state.sessions.find((s) => !s.end) || null;
  },

  // Nickerchen oder Nacht starten
  start(type, at = new Date()) {
    if (this.active()) return null; // nur eine laufende Session gleichzeitig
    const s = { id: uid(), type, start: at.toISOString(), end: null };
    state.sessions.push(s);
    persist();
    if (!applyingRemote) sync.pushSession(s);
    return s;
  },

  // Laufende Session beenden
  stop(at = new Date()) {
    const s = this.active();
    if (!s) return null;
    s.end = at.toISOString();
    if (new Date(s.end) <= new Date(s.start)) {
      // Schutz: Ende muss nach Start liegen (mind. 1 Min.)
      s.end = new Date(new Date(s.start).getTime() + 60000).toISOString();
    }
    persist();
    if (!applyingRemote) sync.pushSession(s);
    return s;
  },

  // Manuellen Eintrag hinzufügen (z. B. Schlafenszeit nachtragen)
  addManual({ type, start, end }) {
    const s = { id: uid(), type, start: new Date(start).toISOString(), end: end ? new Date(end).toISOString() : null };
    state.sessions.push(s);
    persist();
    if (!applyingRemote) sync.pushSession(s);
    return s;
  },

  updateSession(id, patch) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return;
    if (patch.start) patch.start = new Date(patch.start).toISOString();
    if (patch.end) patch.end = new Date(patch.end).toISOString();
    Object.assign(s, patch);
    persist();
    if (!applyingRemote) sync.pushSession(s);
  },

  removeSession(id) {
    state.sessions = state.sessions.filter((s) => s.id !== id);
    persist();
    if (!applyingRemote) sync.deleteSession(id);
  },

  sessionsSorted() {
    return state.sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
  },

  // ---- Familien-Sync -----------------------------------------------------
  snapshot() {
    return { baby: state.baby, sessions: state.sessions };
  },

  // Eingehende Daten aus der Cloud übernehmen (ohne sie zurückzuschreiben)
  applyRemote(remote) {
    applyingRemote = true;
    try {
      if (remote.baby) state.baby = { ...state.baby, ...remote.baby };
      if (remote.sessions) {
        // Nach id zusammenführen: Cloud ist maßgeblich, aber eine gerade
        // lokal laufende (noch nicht hochgeladene) Session nicht verlieren.
        const byId = new Map(remote.sessions.map((s) => [s.id, s]));
        state.sessions.forEach((s) => { if (!s.end && !byId.has(s.id)) byId.set(s.id, s); });
        state.sessions = [...byId.values()];
      }
      persist();
    } finally {
      applyingRemote = false;
    }
  },

  getFamilyCode() {
    try { return localStorage.getItem(FAMILY_KEY) || null; } catch { return null; }
  },
  setFamilyCode(code) {
    try {
      if (code) localStorage.setItem(FAMILY_KEY, code);
      else localStorage.removeItem(FAMILY_KEY);
    } catch { /* ignore */ }
  },

  // Sync starten/stoppen
  async connectSync(code, onStatus) {
    this.setFamilyCode(code);
    return sync.startSync({
      code,
      onStatus,
      localSnapshot: () => this.snapshot(),
      applyRemote: (remote) => { this.applyRemote(remote); listeners.forEach((fn) => fn(state)); },
    });
  },
  disconnectSync() {
    sync.stopSync();
    this.setFamilyCode(null);
  },
  syncAvailable() { return sync.isSyncAvailable(); },
  syncConnected() { return sync.isConnected(); },

  exportJSON() {
    return JSON.stringify(state, null, 2);
  },

  importJSON(raw) {
    const parsed = JSON.parse(raw);
    state = { ...structuredClone(defaultState), ...parsed };
    persist();
    // Bei aktivem Sync die importierten Daten in die Cloud spiegeln
    if (sync.isConnected() && !applyingRemote) {
      sync.pushBaby(state.baby);
      state.sessions.forEach((s) => sync.pushSession(s));
    }
  },

  // Mehrere Sessions auf einmal importieren (z. B. aus Napper-CSV).
  // Lokal zusammenfuehren mit Dedup (type + Startminute); KEIN Sync-Push pro
  // Eintrag – die Historie laedt beim naechsten Sync-Verbinden ohnehin hoch.
  importSessions(list) {
    const keyOf = (s) => `${s.type}|${new Date(s.start).toISOString().slice(0, 16)}`;
    const seen = new Set(state.sessions.map(keyOf));
    let added = 0;
    for (const item of list) {
      const k = keyOf(item);
      if (seen.has(k)) continue;
      seen.add(k);
      state.sessions.push({ id: uid(), type: item.type, start: item.start, end: item.end || null });
      added++;
    }
    persist();
    return added;
  },

  // Setzt die live getrackten Einträge zurück und spielt Mirays mitgelieferte
  // Startdaten erneut ein (kein unwiederbringlicher Totalverlust).
  resetToSeed() {
    if (sync.isConnected()) sync.stopSync();
    this.setFamilyCode(null);
    state = structuredClone(defaultState);
    try { localStorage.setItem(SEED_KEY, '0'); } catch { /* ignore */ }
    applySeedIfNeeded(state);
    persist();
  },
};
