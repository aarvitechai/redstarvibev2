import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, registerUser, selectLogoutReason, selectUser } from '../store/authSlice';
import { logout as logoutThunk } from '../store/sessionActions';

// The SAME API as Phase 8's Context version: { user, isAuthenticated, hasRole, logoutReason, login, logout }.
// Components don't know (or care) that auth now lives in Redux. That's the benefit of a custom hook.
export function useAuth() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const logoutReason = useSelector(selectLogoutReason);

  // .unwrap() turns the thunk's rejected action back into a thrown error, so callers can use try/catch
  const login = useCallback((email, password) => dispatch(loginUser({ email, password })).unwrap(), [dispatch]);
  const logout = useCallback(() => dispatch(logoutThunk()), [dispatch]);
  const register = useCallback((name, email, password) => dispatch(registerUser({ name, email, password })).unwrap(), [dispatch]);

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
      register: async (name, email, password) => {
        try {
          return (await register(name, email, password)).user;
        } catch ({ message, fieldErrors }) {
          throw Object.assign(new Error(message), { fieldErrors }); // field errors for the form
        }
      },
      logout,
    }),
    [user, logoutReason, login, logout, register],
  );
}
