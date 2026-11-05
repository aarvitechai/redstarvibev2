import { Navigate, Outlet, useLocation } from 'react-router';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/authContext';

// A LAYOUT ROUTE that guards its children:
//   not logged in      -> /login, remembering where the user was going (state.from)
//   logged in, no role -> /unauthorized (403)
//   allowed            -> <Outlet />
// This is UX ONLY. Anyone can change the JavaScript in DevTools and render the page anyway.
// The data stays safe because the API refuses the request (401/403), not because this component hides it.
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // replace: the /admin attempt isn't kept in history, so Back after logging in doesn't bounce to /login again
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  if (roles && !roles.some(hasRole)) {
    return <Navigate to={ROUTES.unauthorized} replace state={{ from: location }} />;
  }
  return <Outlet />;
}
