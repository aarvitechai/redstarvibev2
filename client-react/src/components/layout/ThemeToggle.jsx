import { useDispatch, useSelector } from 'react-redux';
import { selectTheme, themeToggled } from '../../store/themeSlice';
import styles from './Layout.module.css';

// useSelector READS from the store (and re-renders only when that value changes).
// useDispatch SENDS an action. The reducer decides the new state.
export default function ThemeToggle() {
  const theme = useSelector(selectTheme);
  const dispatch = useDispatch();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button type="button" className={styles.themeToggle} onClick={() => dispatch(themeToggled())} aria-label={`Switch to ${next} theme`}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
