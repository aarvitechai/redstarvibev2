import { Link, Outlet, useSearchParams } from 'react-router';
import { PRODUCT_PARAMS, ROUTES } from '../../constants/routes';
import { useQuery } from '../../hooks/useQuery';
import { productsApi } from '../../services/productsApi';
import styles from './Products.module.css';

// A NESTED LAYOUT: /products and /products/:id share this sidebar; the child route renders in <Outlet />.
// The categories are loaded ONCE here and handed to the children through the Outlet's `context`.
export default function ProductsLayout() {
  const [searchParams] = useSearchParams();
  const active = searchParams.get(PRODUCT_PARAMS.category) ?? '';
  const categories = useQuery('categories', (signal) => productsApi.categories({ signal }));

  // Build a link that changes ONLY the category, and keeps the search and sort the user already chose
  const categoryLink = (slug) => {
    const next = new URLSearchParams(searchParams);
    next.delete(PRODUCT_PARAMS.page); // another category starts at page 1
    if (slug) next.set(PRODUCT_PARAMS.category, slug);
    else next.delete(PRODUCT_PARAMS.category);
    const query = next.toString();
    return query ? `${ROUTES.products}?${query}` : ROUTES.products;
  };

  const items = [{ slug: '', name: 'All' }, ...(categories.data ?? [])];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Categories</h2>
        <nav aria-label="Categories">
          <ul>
            {items.map((c) => (
              <li key={c.slug || 'all'}>
                {/* NavLink ignores the query string when deciding "active", so it's worked out by hand here */}
                <Link to={categoryLink(c.slug)} aria-current={active === c.slug ? 'page' : undefined}
                  className={active === c.slug ? styles.catActive : styles.cat}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {categories.error && <p role="alert" className={styles.error}>Could not load categories.</p>}
      </aside>
      <div className={styles.content}>
        <Outlet context={{ categories: categories.data ?? [] }} />
      </div>
    </div>
  );
}
