// Production values. Replaced per deployment (CI injects the real API URL).
// NEVER put secrets here: everything in this file ships to every visitor's browser.
export const environment = {
  production: true,
  apiUrl: '/api',
  apiTimeoutMs: 10_000,
};
