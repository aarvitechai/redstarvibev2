import { createContext, useContext } from 'react';

// Context = a value that ANY component below the Provider can read, without passing props through every level.
// Good for small app-wide values (theme, locale). Redux handles bigger state (Phase 9).
export const ThemeContext = createContext(null);

// A custom hook wrapping useContext. It fails loudly if someone forgets the <ThemeProvider>.
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
