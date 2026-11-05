import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onSessionChange, onUnauthorized } from '../../services/session';
import { selectSession, sessionUpdated } from '../../store/authSlice';
import { logout, refreshNow } from '../../store/sessionActions';

const REFRESH_EARLY_MS = 60_000; // refresh a minute before the 15-minute access token expires

// The SIDE EFFECTS of auth, kept out of the reducers (which must stay pure):
//  - refresh the access token shortly before it expires (or log out if there's no refresh token)
//  - mirror a session refreshed inside an HTTP client into Redux
//  - log out when a 401 can't be fixed by refreshing
// It renders nothing. ProtectedRoute does the redirecting (one place, no races).
export default function SessionWatcher() {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);

  useEffect(() => {
    if (!session) return undefined;
    const msLeft = Date.parse(session.expiresAt) - Date.now();
    const timer = session.refreshToken
      ? setTimeout(() => dispatch(refreshNow()), Math.max(0, msLeft - REFRESH_EARLY_MS))
      : setTimeout(() => dispatch(logout('expired')), Math.max(0, msLeft));
    return () => clearTimeout(timer);
  }, [session, dispatch]);

  useEffect(
    () =>
      onSessionChange((next) => {
        if (next) dispatch(sessionUpdated(next)); // a refresh happened in apiClient or the base query
      }),
    [dispatch],
  );

  useEffect(() => onUnauthorized(() => dispatch(logout('expired'))), [dispatch]);

  return null;
}
