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
  apiKey: 'AIzaSyC7ZPHE7gOsMSdbkSuGVJ8bh-hH78MD574',
  authDomain: 'notaytay-4e38b.firebaseapp.com',
  projectId: 'notaytay-4e38b',
  storageBucket: 'notaytay-4e38b.firebasestorage.app',
  messagingSenderId: '787886665571',
  appId: '1:787886665571:web:3cfab2605b0462ed68ad56',
};

// Sync ist verfügbar, sobald ein Projekt eingetragen ist.
export const SYNC_AVAILABLE = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
