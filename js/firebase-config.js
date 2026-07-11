// ============================================================================
//  Firebase-Konfiguration für den Familien-Sync
// ----------------------------------------------------------------------------
//  Diese Werte stammen aus deinem eigenen Firebase-Projekt (siehe README →
//  "Familien-Sync einrichten"). Sie sind KEINE Geheimnisse — sie dürfen
//  öffentlich im Code stehen. Der Schutz läuft über die Firestore-Regeln
//  und den geheimen Familien-Code.
//
//  Solange projectId leer ist, ist der Sync deaktiviert und die App läuft
//  ganz normal rein lokal weiter.
// ============================================================================
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Sync ist verfügbar, sobald ein Projekt eingetragen ist.
export const SYNC_AVAILABLE = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
