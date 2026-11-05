// Single place to read build-time env vars. Only VITE_* vars are exposed to the browser.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5240/api';
