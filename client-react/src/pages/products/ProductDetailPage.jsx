import { Link, useLocation, useParams } from 'react-router';
import { ROUTES } from '../../constants/routes';
import { useQuery } from '../../hooks/useQuery';
import { productsApi } from '../../services/productsApi';
import { formatPrice } from '../../utility/format';
import NotFoundPage from '../NotFoundPage';
import styles from './Products.module.css';

// /products/:id. useParams() gives the URL segments as STRINGS, so validate before use.
export default function ProductDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const validId = /^\d+$/.test(id ?? '');

  const product = useQuery(`product:${id}`, (signal) => productsApi.get(id, { signal }), { enabled: validId });

  // "Back to results" returns to the exact filtered list the user came from (state set by the list's <Link>).
  // When they arrived some other way (a pasted link, a refresh), fall back to the full list.
  const backTo = location.state?.from ?? ROUTES.products;

  // The same 404 UI for a malformed id (/products/abc) and an id that doesn't exist (/products/999)
  if (!validId || product.error?.status === 404) {
    return <NotFoundPage title="Product not found" message={`There is no product with id "${id}".`} />;
  }

  return (
    <article aria-labelledby="product-title" aria-busy={product.loading}>
      <Link to={backTo} className={styles.back}>← Back to results</Link>
      {product.loading && <p className={styles.muted}>Loading…</p>}
      {product.error && (
        <div role="alert" className={styles.error}>
          Could not load this product: {product.error.message}{' '}
          <button type="button" className={styles.button} onClick={product.reload}>Retry</button>
        </div>
      )}
      {product.data && (
        <div className={styles.detail}>
          <title>{`${product.data.name} · RedStarVibe`}</title>
          <Link to={`${ROUTES.products}?category=${product.data.categorySlug}`} className={styles.badge}>
            {product.data.categoryName}
          </Link>
          <h1 id="product-title">{product.data.name}</h1>
          <p>{product.data.description}</p>
          <p className={styles.priceLarge}>{formatPrice(product.data.price)}</p>
        </div>
      )}
    </article>
  );
}
