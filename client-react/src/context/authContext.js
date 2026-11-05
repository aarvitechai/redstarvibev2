import { createContext, useContext } from 'react';

// Who is logged in, plus login/logout. Phase 14 moves this into a Redux authSlice.
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
