import { Link, NavLink } from 'react-router';
import { ROUTES } from '../../constants/routes';
import ThemeToggle from './ThemeToggle';
import styles from './Layout.module.css';

const NAV = [
  { to: ROUTES.products, label: 'Products' },
  { to: ROUTES.students, label: 'Students' },
  { to: ROUTES.directory, label: 'Directory' },
  { to: ROUTES.contacts, label: 'Contacts' },
  { to: ROUTES.playground, label: 'Playground' },
];

// <NavLink> = <Link> that knows when it's ACTIVE: it adds aria-current="page" and lets className be a function.
// <Link> changes the URL WITHOUT a page reload: React swaps the matching route and keeps all app state.
export default function Header({ appName }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={ROUTES.home} className={styles.brand}>{appName}</Link>
        <nav aria-label="Main">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
              {label}
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
