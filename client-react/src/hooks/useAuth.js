import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, logout as logoutThunk, selectLogoutReason, selectUser } from '../store/authSlice';

// The SAME API as Phase 8's Context version: { user, isAuthenticated, hasRole, logoutReason, login, logout }.
// Components don't know (or care) that auth now lives in Redux. That's the benefit of a custom hook.
export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const logoutReason = useSelector(selectLogoutReason);

  // .unwrap() turns the thunk's rejected action back into a thrown error, so callers can use try/catch
  const login = useCallback((email, password) => dispatch(loginUser({ email, password })).unwrap(), [dispatch]);
  const logout = useCallback(() => dispatch(logoutThunk()), [dispatch]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      hasRole: (role) => user?.roles.includes(role) ?? false,
      logoutReason,
      login: async (email, password) => {
        try {
          return (await login(email, password)).user;
        } catch (message) {
          throw new Error(message); // keep Phase 8's contract: login() rejects with an Error
        }
      },
      logout,
    }),
    [user, logoutReason, login, logout],
  );
}
