// The ONE place that reads build-time env vars. Only VITE_* variables reach the browser bundle,
// so NEVER put secrets here: anything in a VITE_ variable can be read by every visitor.
// Values come from .env (local), .env.production (build), or the CI environment.

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5240/api';
export const API_TIMEOUT_MS = toNumber(import.meta.env.VITE_API_TIMEOUT_MS, 10_000);
