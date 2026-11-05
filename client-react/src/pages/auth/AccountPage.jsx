import { useState } from 'react';
import { ROLES } from '../../constants/roles';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '../../hooks/useQuery';
import { adminApi, authApi } from '../../services/authApi';
import styles from '../products/Products.module.css';

// /account: for any logged-in user (ProtectedRoute with no roles)
export default function AccountPage() {
  const { user, hasRole } = useAuth();
  // What the SERVER thinks, read from the token on GET /api/auth/me (not from what's stored in the browser)
  const me = useQuery(`me:${user.id}`, (signal) => authApi.me({ signal }));
  const [probe, setProbe] = useState(null);

  // The lesson of this phase in one button: skip the UI and call the admin API directly
  async function callAdminApi() {
    setProbe({ pending: true });
    try {
      const summary = await adminApi.summary();
      setProbe({ ok: true, text: `200 OK: ${summary.products} products, ${summary.contacts} contacts` });
    } catch (error) {
      setProbe({ ok: false, text: `${error.status}: ${error.message}` });
    }
  }

  return (
    <section aria-labelledby="account-title">
      <title>Account · RedStarVibe</title>
      <h1 id="account-title">Account</h1>
      <div className={styles.detail}>
        <p><strong>{user.name}</strong> · {user.email}</p>
        <p className={styles.muted}>Roles in the browser: {user.roles.join(', ')}</p>
        <p className={styles.muted} aria-live="polite">
          Server says: {me.loading ? 'checking…' : me.error ? me.error.message : `${me.data.name} (${me.data.roles.join(', ')})`}
        </p>
      </div>

      {!hasRole(ROLES.admin) && (
        <div className={styles.detail}>
          <h2>Try it: call the admin API anyway</h2>
          <p className={styles.muted}>
            The Admin link is hidden for you, but hiding a link protects nothing. What protects the data is the API.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={callAdminApi} disabled={probe?.pending}>
              GET /api/admin/summary
            </button>
          </div>
          {probe && !probe.pending && <p role="status" className={probe.ok ? styles.muted : styles.error}>{probe.text}</p>}
        </div>
      )}
    </section>
  );
}
