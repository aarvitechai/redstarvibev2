import { Link } from 'react-router';
import { ROUTES } from '../../constants/routes';
import { useQuery } from '../../hooks/useQuery';
import { adminApi } from '../../services/authApi';
import styles from '../../components/admin/Admin.module.css';

// /admin: the overview. ProtectedRoute roles={[ROLES.admin]} hides it from customers (UX);
// the API's [Authorize(Roles = "Admin")] is what really keeps the numbers private (security).
export default function AdminPage() {
  const summary = useQuery('admin-summary', (signal) => adminApi.summary({ signal }));

  return (
    <section aria-labelledby="admin-title">
      <title>Admin · RedStarVibe</title>
      <h1 id="admin-title">Admin</h1>
      {summary.loading && <p className={styles.muted}>Loading…</p>}
      {summary.error && <p role="alert">{summary.error.message}</p>}
      {summary.data && (
        <ul className={styles.cards} aria-label="Summary">
          <li><Link className={styles.card} to={`${ROUTES.admin}/products`}><span className={styles.muted}>Products</span><strong className={styles.big}>{summary.data.products}</strong></Link></li>
          <li><Link className={styles.card} to={`${ROUTES.admin}/orders`}><span className={styles.muted}>Orders</span><strong className={styles.big}>Manage</strong></Link></li>
          <li className={styles.card}><span className={styles.muted}>Categories</span><strong className={styles.big}>{summary.data.categories}</strong></li>
          <li className={styles.card}><span className={styles.muted}>Contacts</span><strong className={styles.big}>{summary.data.contacts}</strong></li>
        </ul>
      )}
    </section>
  );
}
