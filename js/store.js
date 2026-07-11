// ============================================================================
//  Datenspeicher — lokale Persistenz (localStorage), keine Cloud, keine Konten.
//  Alle Daten bleiben auf dem Gerät.
// ============================================================================

const KEY = 'babysleep.v1';

const defaultState = {
  baby: { name: '', birthDate: '' },
  sessions: [], // { id, type:'nap'|'night', start:ISO, end:ISO|null, note? }
};

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
    return s;
  },

  // Manuellen Eintrag hinzufügen (z. B. Schlafenszeit nachtragen)
  addManual({ type, start, end }) {
    const s = { id: uid(), type, start: new Date(start).toISOString(), end: end ? new Date(end).toISOString() : null };
    state.sessions.push(s);
    persist();
    return s;
  },

  updateSession(id, patch) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return;
    if (patch.start) patch.start = new Date(patch.start).toISOString();
    if (patch.end) patch.end = new Date(patch.end).toISOString();
    Object.assign(s, patch);
    persist();
  },

  removeSession(id) {
    state.sessions = state.sessions.filter((s) => s.id !== id);
    persist();
  },

  sessionsSorted() {
    return state.sessions.slice().sort((a, b) => new Date(b.start) - new Date(a.start));
  },

  exportJSON() {
    return JSON.stringify(state, null, 2);
  },

  importJSON(raw) {
    const parsed = JSON.parse(raw);
    state = { ...structuredClone(defaultState), ...parsed };
    persist();
  },

  clearAll() {
    state = structuredClone(defaultState);
    persist();
  },
};
