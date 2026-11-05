import { saveSession } from '../services/session';
import { baseApi } from './api/baseApi';
import { loggedOut } from './authSlice';

// The logout THUNK: clear storage, announce the logout, and drop every cached API response.
// It lives in its own file so the imports point ONE way (authSlice <- baseApi <- sessionActions), with no cycles.
export const logout = (reason = null) => (dispatch) => {
  saveSession(null);
  dispatch(loggedOut(reason));
  // The next user on this computer must never see the previous user's cached responses
  dispatch(baseApi.util.resetApiState());
};
