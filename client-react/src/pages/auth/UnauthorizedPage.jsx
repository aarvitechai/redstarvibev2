import { Link, useLocation } from 'react-router';
import { ROUTES } from '../../constants/routes';
import styles from '../products/Products.module.css';

// 403: logged in, but not allowed. Different from 401 (not logged in), which goes to /login instead.
export default function UnauthorizedPage() {
  const from = useLocation().state?.from?.pathname;
  return (
    <section className={styles.login} aria-labelledby="forbidden-title">
      <title>Not allowed · RedStarVibe</title>
      <p className={styles.code403}>403</p>
      <h1 id="forbidden-title">You don't have access to this page</h1>
      <p className={styles.muted}>
        {from ? <>Your account can't open <code>{from}</code>.</> : 'Your account does not have the required role.'}
      </p>
      <Link to={ROUTES.home} className={styles.primaryLink}>Go home</Link>
    </section>
  );
}
