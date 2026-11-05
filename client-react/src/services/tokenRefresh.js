import { API_URL } from '../constants/config';
import { getSession, saveSession } from './session';

// SINGLE-FLIGHT refresh: if five requests get a 401 at the same moment, they must share ONE refresh call.
// Five separate calls would send the same refresh token five times. The server would see the 2nd-5th as
// REUSE of a revoked token and (correctly) log the user out everywhere.
let inFlight = null;

export function refreshSession() {
  if (!inFlight) {
    inFlight = doRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Plain fetch, NOT the Axios client or RTK Query: their 401 handling calls this function, and using them here
// would loop (refresh -> 401 -> refresh -> ...).
async function doRefresh() {
  const refreshToken = getSession()?.refreshToken;
  if (!refreshToken) throw new Error('No refresh token');

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const envelope = await response.json().catch(() => null);
  if (!response.ok || !envelope?.success) {
    saveSession(null); // the refresh token is expired or revoked: the session is over
    throw new Error(envelope?.errors?.[0] ?? 'Your session has expired. Please log in again.');
  }
  saveSession(envelope.data); // the NEW access token AND the NEW (rotated) refresh token
  return envelope.data;
}

// Tell the server to revoke the refresh token. Fire-and-forget: logging out must work even if the API is down.
export function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    keepalive: true, // still sent if the page is closing
  }).catch(() => {});
}
