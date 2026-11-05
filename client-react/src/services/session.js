// The session: { accessToken, expiresAt, refreshToken, user }.
// Used by the HTTP clients (token, refresh) and mirrored into Redux (state.auth) by <SessionWatcher />.
//
// WHERE TO KEEP THE TOKENS: a trade-off, not a free choice.
//  - localStorage (used here): survives a reload and is shared by tabs. But ANY script running on the page can
//    read it, so one XSS bug leaks the tokens. Mitigate: no dangerouslySetInnerHTML, a CSP, a SHORT access token
//    (15 min), and refresh-token ROTATION with reuse detection on the server (Phase 12).
//  - memory only: safest against theft, but a reload logs you out.
//  - httpOnly cookie for the refresh token: JavaScript can't read it at all, which is safest against XSS. But the
//    browser sends it automatically, so you need CSRF protection (SameSite cookies or an anti-forgery token).
import { tokenExpiresAt } from '../utility/jwt';

const STORAGE_KEY = 'redstar.session';

let session = null;
let accessToken = null;
const unauthorizedListeners = new Set();
const changeListeners = new Set();

export const getSession = () => session;
export const getAccessToken = () => accessToken;

// Low-level: set only the token (used by tests)
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
  changeListeners.forEach((listener) => listener(session));
}

// Called ONCE in main.jsx, BEFORE the first render, so the very first API request already has the token.
// An expired ACCESS token is fine if there's a refresh token: the first request will refresh it.
export function restoreSession() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    stored = null; // corrupted JSON: treat it as logged out
  }
  // jwt-decode: read the expiry FROM THE TOKEN itself (exp), instead of trusting the stored expiresAt.
  // (Decoding is not verifying: the server still checks the signature on every request.)
  const exp = stored?.accessToken ? tokenExpiresAt(stored.accessToken) : null;
  if (stored && exp) stored.expiresAt = new Date(exp).toISOString();
  const accessStillValid = Boolean(exp) && exp > Date.now();
  const usable = stored?.user && (stored.refreshToken || accessStillValid);
  const valid = usable ? stored : null;
  saveSession(valid); // also clears an unusable or corrupted entry
  return valid;
}

// Something changed the session outside Redux (a token refresh inside an HTTP client): SessionWatcher listens
export function onSessionChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

// Returns an unsubscribe function (the same pattern as useEffect cleanup)
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(error) {
  unauthorizedListeners.forEach((listener) => listener(error));
}
