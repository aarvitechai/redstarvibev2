import { Link, NavLink } from 'react-router';
import { ROLES } from '../../constants/roles';
import { ROUTES } from '../../constants/routes';
import { useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { selectCartCount } from '../../store/cartSlice';
import cartStyles from '../cart/Cart.module.css';
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
// Role-based UI: show only the links this user can use. That's a CONVENIENCE: the API still checks every call.
export default function Header({ appName }) {
  const { user, hasRole, logout } = useAuth();
  const cartCount = useSelector(selectCartCount); // the header re-renders only when the COUNT changes
  const links = [
    ...NAV,
    ...(user ? [{ to: ROUTES.account, label: 'Account' }] : []),
    ...(hasRole(ROLES.admin) ? [{ to: ROUTES.admin, label: 'Admin' }] : []),
  ];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={ROUTES.home} className={styles.brand}>{appName}</Link>
        <nav aria-label="Main">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>
              {label}
            </NavLink>
          ))}
          <NavLink to={ROUTES.cart} className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}>
            Cart{cartCount > 0 && <span className={cartStyles.badge}>{cartCount}</span>}
          </NavLink>
          {user ? (
            <button type="button" className={styles.navButton} onClick={logout}>Log out ({user.name.split(' ')[0]})</button>
          ) : (
            <NavLink to={ROUTES.login} className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}>Log in</NavLink>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
