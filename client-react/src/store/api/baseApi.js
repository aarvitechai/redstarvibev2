import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_TIMEOUT_MS, API_URL } from '../../constants/config';
import { networkActivity } from '../../services/networkActivity';
import { saveSession } from '../../services/session';
import { refreshSession } from '../../services/tokenRefresh';
import { loggedOut, sessionUpdated } from '../authSlice';

// RTK QUERY: server data (lists, details) cached in the store, with loading flags, de-duplication and refetching
// handled for you. Redux slices hold CLIENT state (cart, auth); RTK Query holds SERVER state.

// fetchBaseQuery = a small fetch wrapper. prepareHeaders runs before EVERY request:
// it reads the token straight from Redux state, so there's no separate token variable to keep in sync.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: API_TIMEOUT_MS,
  prepareHeaders: (headers, { getState }) => {
    headers.set('X-Correlation-Id', crypto.randomUUID());
    const token = getState().auth.session?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

// Turn any failure into ONE serialisable shape: { status, message, fieldErrors }.
// (Redux state must stay serialisable, so no Error objects here.)
function toError(error) {
  if (error.status === 'FETCH_ERROR') return { status: 0, message: 'Network error: could not reach the server.', fieldErrors: null };
  if (error.status === 'TIMEOUT_ERROR') return { status: 0, message: 'The server took too long to respond. Please try again.', fieldErrors: null };
  const envelope = error.data;
  return {
    status: typeof error.status === 'number' ? error.status : 0,
    message: envelope?.errors?.[0] ?? `Request failed (${error.status})`,
    fieldErrors: envelope?.fieldErrors ?? null,
  };
}

// A WRAPPER around the base query: the RTK Query version of the Phase 6 Axios interceptors.
//   - unwrap the { success, data, errors } envelope, so endpoints receive just `data`
//   - map errors to one shape
//   - on a 401 for a request that CARRIED our token, log out (ProtectedRoute then redirects)
//   - feed the global activity bar
export const baseQuery = async (args, api, extraOptions) => {
  networkActivity.start();
  try {
    const session = api.getState().auth.session;
    let result = await rawBaseQuery(args, api, extraOptions);

    // Phase 12: a 401 for a request that CARRIED a token usually means the 15-minute access token expired.
    // Refresh ONCE (shared with any other request doing the same), then retry with the new token.
    if (result.error?.status === 401 && session?.accessToken && session.refreshToken) {
      try {
        api.dispatch(sessionUpdated(await refreshSession())); // prepareHeaders now reads the NEW token
        result = await rawBaseQuery(args, api, extraOptions);
      } catch {
        // the refresh failed too: fall through to the logout below
      }
    }

    if (result.error) {
      const error = toError(result.error);
      if (error.status === 401 && session?.accessToken) {
        saveSession(null);
        api.dispatch(loggedOut('expired'));
        api.dispatch(baseApi.util.resetApiState());
      }
      return { error, meta: result.meta };
    }
    if (result.meta?.response?.status === 204) return { data: null, meta: result.meta };
    const envelope = result.data;
    if (envelope && envelope.success === false) {
      return { error: toError({ status: result.meta?.response?.status ?? 200, data: envelope }), meta: result.meta };
    }
    return { data: envelope?.data ?? envelope, meta: result.meta };
  } finally {
    networkActivity.end();
  }
};

// ONE api slice for the whole app. Feature files add their endpoints with injectEndpoints (store/api/*.js),
// which keeps this file small and lets features be code-split.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
  // TAGS: labels that connect queries to mutations. A query PROVIDES tags; a mutation INVALIDATES them.
  // Any cached query whose tags were invalidated refetches automatically, so the UI stays in sync.
  tagTypes: ['Destination', 'Order', 'AdminProduct', 'AdminOrder'],
  keepUnusedDataFor: 60, // seconds to keep data no component uses any more (navigate away and back: instant)
  endpoints: () => ({}),
});
