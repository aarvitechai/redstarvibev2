import { saveSession } from '../services/session';

// Phase 12: Identity user ids are GUID strings
export const ADMIN = { id: 'a0000000-0000-0000-0000-000000000001', name: 'Admin User', email: 'admin@redstar.dev', roles: ['Admin'] };
export const CUSTOMER = { id: 'c0000000-0000-0000-0000-000000000002', name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] };

// Start a test already logged in (the same thing restoreSession() does on a real page load).
// refreshToken: pass one to test the Phase 12 refresh flow; without it the session behaves like Phase 8 (no refresh).
export function loginAs(user, { minutes = 30, refreshToken = null } = {}) {
  const session = {
    accessToken: `access-${user.id}-${Date.now()}`,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    refreshToken,
    user,
  };
  saveSession(session);
  return session;
}
