import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/authApi';
import { getSession, onUnauthorized, saveSession } from '../services/session';
import { AuthContext } from './authContext';

// AUTHENTICATION = who you are (login). AUTHORIZATION = what you may do (roles).
// This provider only tracks the logged-in user for the UI. The API checks the token on EVERY request,
// and that is the real security boundary.
//
// ONE place redirects: ProtectedRoute. This provider never navigates. When the session ends, it records WHY
// (logoutReason), and ProtectedRoute sends the user to /login while remembering where they were.
// (An earlier version also called navigate() here, and the two redirects raced each other.)
export default function AuthProvider({ children }) {
  // restoreSession() already ran in main.jsx (before the first render), so this is just a read
  const [session, setSession] = useState(() => getSession());
  const [logoutReason, setLogoutReason] = useState(null); // null | 'expired'

  const logout = useCallback((reason = null) => {
    saveSession(null);
    setSession(null);
    setLogoutReason(reason);
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password); // throws ApiError (401) on bad credentials
    saveSession(result);
    setSession(result);
    setLogoutReason(null);
    return result.user;
  }, []);

  // Log out exactly when the token expires
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(() => logout('expired'), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session, logout]);

  // The API said 401 to a request that carried our token (expired or revoked server-side)
  useEffect(() => onUnauthorized(() => logout('expired')), [logout]);

  const value = useMemo(() => {
    const user = session?.user ?? null;
    return {
      user,
      isAuthenticated: user !== null,
      hasRole: (role) => user?.roles.includes(role) ?? false,
      logoutReason,
      login,
      logout: () => logout(), // a manual logout has no "reason" message
    };
  }, [session, logoutReason, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
