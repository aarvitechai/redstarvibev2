import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { onUnauthorized } from '../../services/session';
import { logout, selectSession } from '../../store/authSlice';

// The SIDE EFFECTS of auth, kept out of the reducers (which must stay pure):
//  - log out exactly when the token expires
//  - log out when the API answers 401 to a request that carried our token
// It renders nothing. ProtectedRoute does the redirecting (one place, no races).
export default function SessionWatcher() {
  const dispatch = useDispatch();
  const session = useSelector(selectSession);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(() => dispatch(logout('expired')), Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [session, dispatch]);

  useEffect(() => onUnauthorized(() => dispatch(logout('expired'))), [dispatch]);

  return null;
}
