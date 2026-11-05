import { useEffect, useState } from 'react';

// Returns `value`, but only after it has stopped changing for `delayMs`.
// While typing "comp", the API is called once (for "comp"), not four times (c, co, com, comp).
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    // CLEANUP runs before the next effect (on the next keystroke) and on unmount.
    // It cancels the pending timer, which is what makes this a debounce.
    return () => clearTimeout(timer);
  }, [value, delayMs]); // re-run whenever value or delay changes

  return debounced;
}
