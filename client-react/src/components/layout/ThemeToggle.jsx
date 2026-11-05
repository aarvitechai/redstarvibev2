import { useTheme } from '../../context/themeContext';
import styles from './Layout.module.css';

// Header -> ThemeToggle: no theme props passed down. It reads the value straight from context.
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button type="button" className={styles.themeToggle} onClick={toggleTheme} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
