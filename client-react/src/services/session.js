// Phase 6: a tiny session module the interceptors use.
//  - the access token (Phase 12 sets it after login; Redux takes over in Phase 9/14)
//  - "unauthorized" listeners: the response interceptor calls them on any 401, so the app can log out
//    and redirect from ONE place instead of in every component.
let accessToken = null;
const unauthorizedListeners = new Set();

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token || null;
};

// Returns an unsubscribe function (the same pattern as useEffect cleanup)
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(error) {
  unauthorizedListeners.forEach((listener) => listener(error));
}
