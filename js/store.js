// ============================================================================
//  Datenspeicher — lokale Persistenz (localStorage), keine Cloud, keine Konten.
//  Alle Daten bleiben auf dem Gerät.
// ============================================================================

import * as sync from './sync.js';

const KEY = 'babysleep.v1';
const FAMILY_KEY = 'babysleep.family'; // Familien-Code separat (nicht im Export/Sync)

const defaultState = {
  baby: { name: '', birthDate: '' },
  sessions: [], // { id, type:'nap'|'night', start:ISO, end:ISO|null, note? }
};

let applyingRemote = false; // verhindert Rück-Push während eingehender Sync-Daten

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = load();
const listeners = new Set();

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

  clearAll() {
    // Sync trennen, damit NICHT versehentlich die Daten des Partners
    // in der Cloud gelöscht werden. Löscht nur lokal auf diesem Gerät.
    if (sync.isConnected()) sync.stopSync();
    this.setFamilyCode(null);
    state = structuredClone(defaultState);
    persist();
  },
};
