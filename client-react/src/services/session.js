// The session: { accessToken, expiresAt, user }. Used by the Axios interceptor (token) and AuthProvider (user).
//
// WHERE TO KEEP THE TOKEN: a trade-off, not a free choice.
//  - localStorage (used here): survives a reload and is shared by tabs. But ANY script running on the page can
//    read it, so one XSS bug leaks the token. Mitigate: no dangerouslySetInnerHTML, short token lifetimes, and a CSP.
//  - memory only: safest against theft, but a reload logs you out.
//  - httpOnly cookie: JavaScript can't read it at all, which is safest against XSS. But the browser sends it
//    automatically, so you need CSRF protection (SameSite cookies or an anti-forgery token).
// Phase 12 adds short-lived access tokens + refresh tokens to shrink the damage if a token leaks.
const STORAGE_KEY = 'redstar.session';

let session = null;
let accessToken = null;
const unauthorizedListeners = new Set();

export const getSession = () => session;
export const getAccessToken = () => accessToken;

// Low-level: set only the token (used by tests and by saveSession)
export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const isExpired = (s, now = Date.now()) => !s || !(Date.parse(s.expiresAt) > now);

export function saveSession(next) {
  session = next ?? null;
  setAccessToken(next?.accessToken);
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode, browser settings). The session still works until the next reload.
  }
}

// Called ONCE in main.jsx, BEFORE the first render, so the very first API request already has the token.
// A stored session that has already expired is thrown away (the user has to log in again).
export function restoreSession(now = Date.now()) {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    stored = null; // corrupted JSON: treat it as logged out
  }
  const valid = stored?.accessToken && stored?.user && !isExpired(stored, now) ? stored : null;
  saveSession(valid); // also clears an expired or corrupted entry
  return valid;
}

// Returns an unsubscribe function (the same pattern as useEffect cleanup)
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(error) {
  unauthorizedListeners.forEach((listener) => listener(error));
}
