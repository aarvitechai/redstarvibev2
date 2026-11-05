import { useQuery } from '../../hooks/useQuery';
import { adminApi } from '../../services/authApi';
import styles from '../products/Products.module.css';

// /admin: ProtectedRoute roles={[ROLES.admin]} hides it from customers (UX),
// and the API's [Authorize(Roles = "Admin")] is what really keeps the numbers private (security).
export default function AdminPage() {
  const summary = useQuery('admin-summary', (signal) => adminApi.summary({ signal }));

  return (
    <section aria-labelledby="admin-title">
      <title>Admin · RedStarVibe</title>
      <h1 id="admin-title">Admin</h1>
      {summary.loading && <p className={styles.muted}>Loading…</p>}
      {summary.error && <p role="alert" className={styles.error}>{summary.error.message}</p>}
      {summary.data && (
        <ul className={styles.cards} aria-label="Summary">
          {Object.entries(summary.data).map(([key, value]) => (
            <li key={key} className={styles.card}>
              <span className={styles.muted}>{key[0].toUpperCase() + key.slice(1)}</span>
              <strong className={styles.priceLarge}>{value}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
