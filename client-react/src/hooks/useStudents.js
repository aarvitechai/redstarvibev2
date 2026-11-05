import { useEffect, useState } from 'react';
import { isAbortError } from '../services/http';
import { fetchStudents } from '../services/studentsApi';

// A CUSTOM HOOK: a function whose name starts with "use" and that calls other hooks.
// It packages "load students for a search term" so any component can call one line:
//   const { students, loading, error } = useStudents(search);
// (Phase 10 replaces this with RTK Query, which adds caching for free.)
export function useStudents(search = '') {
  const [reloadCount, setReloadCount] = useState(0);
  // Every distinct request gets a key. The stored result remembers which request it answers.
  const requestKey = `${reloadCount}:${search}`;
  const [result, setResult] = useState({ key: null, students: [], error: null });

  useEffect(() => {
    // RACE CONDITION: if "co" is slower than "comp", an old response could arrive LAST and overwrite the new one.
    // Fix: abort the previous request in the cleanup, and ignore the cancellation error it throws.
    const controller = new AbortController();

    fetchStudents({ search, signal: controller.signal })
      .then((students) => setResult({ key: requestKey, students, error: null }))
      .catch((err) => {
        if (isAbortError(err)) return; // cancelled on purpose: not a real error
        setResult({ key: requestKey, students: [], error: err.message });
      });

    return () => controller.abort(); // runs when the request changes and on unmount
  }, [requestKey, search]);

  // DERIVED, not stored: we're loading whenever the latest result isn't for the current request.
  // (Calling setLoading(true) at the top of the effect would cost an extra render; the linter flags that.)
  // While loading, the previous students stay visible instead of the list flashing empty.
  const loading = result.key !== requestKey;

  return {
    students: result.students,
    loading,
    error: loading ? null : result.error,
    reload: () => setReloadCount((n) => n + 1),
  };
}
