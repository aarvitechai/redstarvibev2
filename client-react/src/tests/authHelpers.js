import { jwtDecode } from 'jwt-decode';
import { saveSession } from '../services/session';

// Phase 12: Identity user ids are GUID strings
export const ADMIN = { id: 'a0000000-0000-0000-0000-000000000001', name: 'Admin User', email: 'admin@redstar.dev', roles: ['Admin'] };
export const CUSTOMER = { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] };

// A JWT-SHAPED token (header.payload.signature) that jwt-decode can read. The signature is fake:
// fine for the client, which only DECODES. The real server would reject it (it VERIFIES).
export function fakeJwt({ sub, exp }) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp })}.fake-signature`;
}

// Start a test already logged in (the same thing restoreSession() does on a real page load).
// refreshToken: pass one to test the Phase 12 refresh flow; without it the session behaves like Phase 8 (no refresh).
export function loginAs(user, { minutes = 30, refreshToken = null } = {}) {
  const expiresAt = Date.now() + minutes * 60_000;
  const session = {
    accessToken: fakeJwt({ sub: user.id, exp: Math.floor(expiresAt / 1000) }),
    expiresAt: new Date(expiresAt).toISOString(),
    refreshToken,
    user,
  };
  saveSession(session);
  return session;
}

// Fake APIs use this to tell WHO a token belongs to (decoding only, like the client; the real server verifies)
export function subOf(token) {
  try {
    return jwtDecode(token).sub;
  } catch {
    return token;
  }
}
