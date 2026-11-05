import { getSession, saveSession } from '../services/session';
import { refreshSession, revokeRefreshToken } from '../services/tokenRefresh';
import { baseApi } from './api/baseApi';
import { loggedOut, sessionUpdated } from './authSlice';

// The logout THUNK: revoke the refresh token on the server, clear storage, announce the logout, and drop every
// cached API response. It lives in its own file so the imports point ONE way (authSlice <- baseApi <- sessionActions).
export const logout = (reason = null) => (dispatch) => {
  // A manual logout revokes the refresh token, so a copy of it can't be used later.
  // (After 'expired', the server has already refused it, so there's nothing to revoke.)
  if (reason !== 'expired') revokeRefreshToken(getSession()?.refreshToken);
  saveSession(null);
  dispatch(loggedOut(reason));
  // The next user on this computer must never see the previous user's cached responses
  dispatch(baseApi.util.resetApiState());
};

// Refresh BEFORE the access token expires, so requests don't have to fail first. If that's impossible, log out.
export const refreshNow = () => async (dispatch) => {
  try {
    dispatch(sessionUpdated(await refreshSession()));
  } catch {
    dispatch(logout('expired'));
  }
};
