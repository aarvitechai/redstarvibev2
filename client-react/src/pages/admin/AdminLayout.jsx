import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { ROUTES } from '../../constants/routes';
import styles from '../../components/admin/Admin.module.css';

const LINKS = [
  { to: ROUTES.admin, label: 'Overview', end: true },
  { to: `${ROUTES.admin}/products`, label: 'Products' },
  { to: `${ROUTES.admin}/orders`, label: 'Orders' },
];

// The admin area's own nested layout. Its pages are LAZY-loaded (see App.jsx): customers never download the
// admin code. <Suspense> shows a fallback while a page's code is being fetched.
export default function AdminLayout() {
  return (
    <div className={styles.adminLayout}>
      <nav aria-label="Admin" className={styles.adminNav}>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? styles.adminLinkActive : styles.adminLink)}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className={styles.adminContent}>
        <Suspense fallback={<p className={styles.muted} role="status">Loading admin page…</p>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
