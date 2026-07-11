// ============================================================================
//  Familien-Sync — Echtzeit-Synchronisierung über Firebase Firestore
// ----------------------------------------------------------------------------
//  Beide Elternteile geben denselben geheimen Familien-Code ein. Die Daten
//  liegen dann unter families/{code} in Firestore und werden live zwischen
//  allen Geräten abgeglichen.
//
//  Firebase wird NUR bei aktivem Sync per dynamischem Import vom CDN geladen —
//  ohne Sync (oder offline) funktioniert die App vollständig lokal weiter.
// ============================================================================
import { firebaseConfig, SYNC_AVAILABLE } from './firebase-config.js';

const CDN = 'https://www.gstatic.com/firebasejs/10.12.5';

let fb = null;          // gebündelte Firestore-Funktionen
let db = null;
let unsubscribers = [];
let familyCode = null;
let statusCb = () => {};
let getLocal = () => ({ baby: {}, sessions: [] });
let onRemote = () => {};
let connected = false;

export function isSyncAvailable() {
  return SYNC_AVAILABLE;
}
export function isConnected() {
  return connected;
}

// ---------------------------------------------------------------------------
//  Verbindung aufbauen
// ---------------------------------------------------------------------------
export async function startSync({ code, onStatus, localSnapshot, applyRemote }) {
  if (!SYNC_AVAILABLE) { (onStatus || (() => {}))('unavailable'); return false; }
  familyCode = code;
  statusCb = onStatus || (() => {});
  getLocal = localSnapshot;
  onRemote = applyRemote;
  statusCb('connecting');

  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
    fb = { ...authMod, ...fsMod };

    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    await authMod.signInAnonymously(auth);
    await new Promise((resolve) => {
      const off = authMod.onAuthStateChanged(auth, (user) => { if (user) { off(); resolve(); } });
    });
    db = fsMod.getFirestore(app);

    // 1) Lokale Daten hochladen, damit beim ersten Verbinden nichts verloren geht
    const local = getLocal();
    if (local.baby && (local.baby.name || local.baby.birthDate)) await pushBaby(local.baby);
    await Promise.all((local.sessions || []).map((s) => pushSession(s)));

    // 2) Live-Abonnements
    const famDoc = fsMod.doc(db, 'families', code);
    const sessCol = fsMod.collection(db, 'families', code, 'sessions');

    unsubscribers.push(fsMod.onSnapshot(famDoc, (snap) => {
      const data = snap.data();
      if (data && data.baby) onRemote({ baby: data.baby });
    }, (err) => statusCb('error', err.message)));

    unsubscribers.push(fsMod.onSnapshot(sessCol, (snap) => {
      const sessions = [];
      snap.forEach((d) => {
        const { updatedAt, ...rest } = d.data();
        sessions.push({ id: d.id, ...rest });
      });
      onRemote({ sessions });
    }, (err) => statusCb('error', err.message)));

    connected = true;
    statusCb('connected');
    return true;
  } catch (e) {
    console.error('Sync-Fehler:', e);
    connected = false;
    statusCb('error', e.message);
    return false;
  }
}

export function stopSync() {
  unsubscribers.forEach((u) => { try { u(); } catch { /* ignore */ } });
  unsubscribers = [];
  db = null;
  connected = false;
  statusCb('disconnected');
}

// ---------------------------------------------------------------------------
//  Schreiboperationen (werden vom Store aufgerufen)
// ---------------------------------------------------------------------------
export async function pushBaby(baby) {
  if (!db) return;
  try {
    await fb.setDoc(fb.doc(db, 'families', familyCode), { baby, updatedAt: Date.now() }, { merge: true });
  } catch (e) { console.warn('pushBaby fehlgeschlagen', e); }
}

export async function pushSession(s) {
  if (!db) return;
  const { id, ...rest } = s;
  try {
    await fb.setDoc(fb.doc(db, 'families', familyCode, 'sessions', id), { ...rest, updatedAt: Date.now() });
  } catch (e) { console.warn('pushSession fehlgeschlagen', e); }
}

export async function deleteSession(id) {
  if (!db) return;
  try {
    await fb.deleteDoc(fb.doc(db, 'families', familyCode, 'sessions', id));
  } catch (e) { console.warn('deleteSession fehlgeschlagen', e); }
}
