import { useEffect, useMemo, useState } from 'react';
import { ThemeContext } from './themeContext';

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;

export default function ThemeProvider({ children }) {
  // Lazy initializer: the function runs only on the FIRST render, not on every render
  const [theme, setTheme] = useState(() => (prefersDark() ? 'dark' : 'light'));

  // An effect SYNCHRONISES React state with something outside React (here, the <html> element)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // useMemo keeps the same object between renders, so the consumers don't re-render
  // just because this provider re-rendered. A new {} on every render would change the context value each time.
  const value = useMemo(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
