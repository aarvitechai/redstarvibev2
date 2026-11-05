import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { THEME_KEY, selectTheme } from '../../store/themeSlice';

// Redux holds the theme; this effect SYNCHRONISES it to <html data-theme> (something outside React)
export default function ThemeSync() {
  const theme = useSelector(selectTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme); // remembered across reloads (plan 14.8)
    } catch {
      // storage blocked: the theme still works for this visit
    }
  }, [theme]);
  return null;
}
