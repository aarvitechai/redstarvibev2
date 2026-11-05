import { useEffect, useState } from 'react';
import { isAbortError } from '../services/http';

// A GENERIC version of Phase 4's useStudents: load anything, cancel stale requests, derive `loading`.
//   const { data, loading, error, reload } = useQuery(`product:${id}`, (signal) => productsApi.get(id, { signal }));
// `key` must change whenever the request changes (it plays the role of a dependency array).
// The fetcher is read inside the effect, so a new function on every render doesn't cause refetching.
// (Phase 10 replaces this with RTK Query.)
export function useQuery(key, fetcher, { enabled = true } = {}) {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${reloadCount}|${key}`;
  const [result, setResult] = useState({ key: null, data: undefined, error: null });

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error) => {
        if (!isAbortError(error)) setResult({ key: requestKey, data: undefined, error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the request; see above
  }, [requestKey, enabled]);

  const loading = enabled && result.key !== requestKey;
  return {
    data: result.data,
    loading,
    error: loading ? null : result.error, // the full ApiError, so callers can check .status (e.g. 404)
    reload: () => setReloadCount((n) => n + 1),
  };
}
