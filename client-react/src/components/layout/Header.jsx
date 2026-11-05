import ThemeToggle from './ThemeToggle';
import styles from './Layout.module.css';

// Props are read-only inputs. The parent decides `appName`; Header only displays it.
export default function Header({ appName }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.brand}>{appName}</span>
        <nav aria-label="Main">
          {/* Plain links for now; React Router <Link> replaces them in Phase 7 */}
          <a className={styles.navLink} href="#students">Students</a>
          <a className={styles.navLink} href="#directory">Directory</a>
          <a className={styles.navLink} href="#playground">Playground</a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
