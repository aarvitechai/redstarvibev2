import { Link, useLocation, useNavigate } from 'react-router';
import { ROUTES } from '../constants/routes';
import styles from './products/Products.module.css';

// Rendered by the catch-all route (path="*"), and also by pages whose data doesn't exist (e.g. /products/999).
export default function NotFoundPage({ title = 'Page not found', message }) {
  const { pathname } = useLocation();
  const navigate = useNavigate(); // navigate in code, e.g. "go back one entry in history"

  return (
    <section className={styles.notFound} aria-labelledby="not-found-title">
      <title>{`${title} · RedStarVibe`}</title>
      <p className={styles.code}>404</p>
      <h1 id="not-found-title">{title}</h1>
      <p className={styles.muted}>{message ?? <>Nothing lives at <code>{pathname}</code>.</>}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => navigate(-1)}>Go back</button>
        <Link to={ROUTES.home} className={styles.primaryLink}>Go home</Link>
      </div>
    </section>
  );
}
