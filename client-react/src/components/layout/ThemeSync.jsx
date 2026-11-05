import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectTheme } from '../../store/themeSlice';

// Redux holds the theme; this effect SYNCHRONISES it to <html data-theme> (something outside React)
export default function ThemeSync() {
  const theme = useSelector(selectTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}
