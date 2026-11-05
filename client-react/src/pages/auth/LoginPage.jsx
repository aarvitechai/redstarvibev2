import { useActionState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { ROUTES } from '../../constants/routes';
import Field from '../../components/contacts/Field';
import { useAuth } from '../../hooks/useAuth';
import { safeRedirect } from '../../utility/redirect';
import styles from '../products/Products.module.css';
import formStyles from '../../components/contacts/Contacts.module.css';

const DEMO = [
  { label: 'Admin', email: 'admin@redstar.dev', password: 'Admin@123' },
  { label: 'Customer', email: 'asha@redstar.dev', password: 'Customer@123' },
];

export default function LoginPage() {
  const { isAuthenticated, login, logoutReason } = useAuth();
  const location = useLocation();
  const target = safeRedirect(location.state?.from);
  const expired = logoutReason === 'expired';

  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    if (!email || !password) return { error: 'Enter your email and password.', email };
    try {
      await login(email, password);
      return { error: null, email }; // the re-render below sees isAuthenticated and redirects
    } catch (error) {
      return { error: error.message, email };
    }
  }, { error: null, email: '' });

  // Already logged in (or just logged in): go where the user was heading.
  // Doing this with <Navigate> during render, not in an effect, means the login form never flashes.
  if (isAuthenticated) return <Navigate to={target} replace />;

  return (
    <section className={styles.login} aria-labelledby="login-title">
      <title>Log in · RedStarVibe</title>
      <h1 id="login-title">Log in</h1>
      {expired && <p role="status" className={styles.muted}>Your session has expired. Please log in again.</p>}
      {target !== '/' && !expired && <p role="status" className={styles.muted}>Log in to continue to <code>{target}</code>.</p>}

      <form className={formStyles.form} action={formAction} noValidate aria-label="Log in">
        <Field label="Email" name="email" type="email" autoComplete="username" defaultValue={state.email} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        {state.error && <p role="alert" className={formStyles.formError}>{state.error}</p>}
        <button type="submit" className={formStyles.primary} disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      </form>

      <p className={styles.muted}>New here? <Link to={ROUTES.register} state={location.state}>Create an account</Link></p>

      <details className={styles.demo}>
        <summary>Demo accounts (development only)</summary>
        <ul>
          {DEMO.map((d) => <li key={d.email}><strong>{d.label}:</strong> <code>{d.email}</code> / <code>{d.password}</code></li>)}
        </ul>
      </details>
    </section>
  );
}
