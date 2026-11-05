import { useActionState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import Field from '../../components/contacts/Field';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { safeRedirect } from '../../utility/redirect';
import styles from '../products/Products.module.css';
import formStyles from '../../components/contacts/Contacts.module.css';

const EMPTY = { name: '', email: '', errors: {} };

// Phase 12: create an account. The API makes every new account a Customer and signs it in straight away.
export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const target = safeRedirect(useLocation().state?.from);

  const [state, formAction, pending] = useActionState(async (_prev, formData) => {
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');

    // Client checks for quick feedback. The SERVER enforces the real password policy and the unique email.
    const errors = {};
    if (name.length < 2) errors.name = 'Name must be 2 to 100 characters.';
    if (!email) errors.email = 'Email is required.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (confirm !== password) errors.confirm = 'The passwords do not match.';
    if (Object.keys(errors).length) return { name, email, errors };

    try {
      await register(name, email, password);
      return { name, email, errors: {} }; // the re-render sees isAuthenticated and redirects
    } catch (error) {
      const fieldErrors = Object.fromEntries(Object.entries(error.fieldErrors ?? {}).map(([k, v]) => [k, v.join(' ')]));
      return { name, email, errors: Object.keys(fieldErrors).length ? fieldErrors : { _form: error.message } };
    }
  }, EMPTY);

  if (isAuthenticated) return <Navigate to={target} replace />;

  return (
    <section className={styles.login} aria-labelledby="register-title">
      <title>Create account · RedStarVibe</title>
      <h1 id="register-title">Create an account</h1>
      <form className={formStyles.form} action={formAction} noValidate aria-label="Create account">
        <Field label="Name" name="name" autoComplete="name" defaultValue={state.name} error={state.errors.name} />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} error={state.errors.email} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" error={state.errors.password}
          hint="At least 8 characters, with upper and lower case, a number and a symbol." />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" error={state.errors.confirm} />
        {state.errors._form && <p role="alert" className={formStyles.formError}>{state.errors._form}</p>}
        <button type="submit" className={formStyles.primary} disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className={styles.muted}>Already have an account? <Link to={ROUTES.login}>Log in</Link></p>
    </section>
  );
}
