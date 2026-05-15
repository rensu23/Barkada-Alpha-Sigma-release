const emptyDatabaseShape = {
  users: [],
  groups: [],
  group_members: [],
  contributions: [],
  payment_records: [],
  activity_logs: [],
};

/*
  Backend-ready state adapter.
  The previous browser-backed data store has been removed. Real data must come from
  PHP endpoints backed by barkada_db.sql tables, with PHP sessions as auth truth.
*/

export function getState() {
  return structuredClone(window.BARKADA_STATE || emptyDatabaseShape);
}

export function saveState(state) {
  // This no-op intentionally prevents frontend persistence from pretending to be MySQL.
  return state;
}

export function getSession() {
  return window.BARKADA_SESSION || null;
}

export function buildSessionForUser(user) {
  // Kept only for import stability while PHP login replaces client sessions.
  return user ? { user_id: user.user_id, name: user.name, email: user.email } : null;
}

export function saveSession(session) {
  // Login state is owned by PHP sessions. This function is kept for older imports.
  return session;
}

export function updateSession(patch) {
  window.BARKADA_SESSION = { ...(getSession() || {}), ...patch };
  return window.BARKADA_SESSION;
}

export function clearSession() {
  window.BARKADA_SESSION = null;
  window.BARKADA_STATE = structuredClone(emptyDatabaseShape);
}
