// A minimal EXTERNAL STORE: plain JavaScript that lives outside React.
// The interceptors call start()/end(); React reads it through useSyncExternalStore (hooks/useNetworkActivity.js).
let pending = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const networkActivity = {
  start() {
    pending += 1;
    emit();
  },
  end() {
    pending = Math.max(0, pending - 1);
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => pending,
};
