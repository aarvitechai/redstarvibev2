import { saveSession } from '../services/session';

export const ADMIN = { id: 1, name: 'Admin User', email: 'admin@redstar.dev', roles: ['Admin'] };
export const CUSTOMER = { id: 2, name: 'Asha Verma', email: 'asha@redstar.dev', roles: ['Customer'] };

// Start a test already logged in (the same thing restoreSession() does on a real page load)
export function loginAs(user, { minutes = 30 } = {}) {
  const session = {
    accessToken: `demo.${user.id}.${Math.floor(Date.now() / 1000) + minutes * 60}`,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    user,
  };
  saveSession(session);
  return session;
}
