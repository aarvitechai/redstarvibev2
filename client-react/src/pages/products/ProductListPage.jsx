import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router';
import { PRODUCT_PARAMS, PRODUCT_SORTS, productPath } from '../../constants/routes';
import { useQuery } from '../../hooks/useQuery';
import { imageSrc, productsApi } from '../../services/productsApi';
import { formatPrice } from '../../utility/format';
import AddToCartButton from '../../components/cart/AddToCartButton';
import styles from './Products.module.css';

// THE URL IS THE STATE. category, q and sort live in the query string, not in useState:
//  - refresh the page -> same results
//  - copy the link to a friend -> same results
//  - the Back button -> previous filters
export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useOutletContext();
  const location = useLocation();

  const category = searchParams.get(PRODUCT_PARAMS.category) ?? '';
  const sort = searchParams.get(PRODUCT_PARAMS.sort) ?? 'name';
  const urlSearch = searchParams.get(PRODUCT_PARAMS.search) ?? '';
  const page = Math.max(1, Number(searchParams.get(PRODUCT_PARAMS.page)) || 1);

  // The text box is local while typing; the URL (and so the request) updates after a 300 ms pause.
  // `typed` = { forUrl, value }: what the user typed, and which URL value it belongs to. If the URL changes from
  // outside (Back button, "Clear filters"), forUrl no longer matches, so the box shows the URL's value instead.
  const [typed, setTyped] = useState({ forUrl: urlSearch, value: urlSearch });
  const searchBox = typed.forUrl === urlSearch ? typed.value : urlSearch;

  // Debounce in the EVENT HANDLER (typing is an event), not in an effect or during render.
  // useRef holds the timer id: it must survive re-renders, and changing it must not cause one.
  const timer = useRef(undefined);
  useEffect(() => () => clearTimeout(timer.current), []); // cleanup on unmount: no URL change after leaving the page

  function onSearchChange(value) {
    setTyped({ forUrl: urlSearch, value });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyped({ forUrl: value.trim(), value }); // keep the raw text (e.g. a trailing space) in the box
      // replace: true -> no history entry for every pause in typing
      updateParams({ [PRODUCT_PARAMS.search]: value.trim(), [PRODUCT_PARAMS.page]: '' }, { replace: true }); // a new search starts at page 1
    }, 300);
  }

  function clearFilters() {
    clearTimeout(timer.current);
    setSearchParams({});
  }

  function updateParams(changes, options) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    }, options);
  }

  const filters = { category, search: urlSearch, sort, page };
  const products = useQuery(JSON.stringify(filters), (signal) => productsApi.list(filters, { signal }));

  const categoryName = categories.find((c) => c.slug === category)?.name;
  const heading = category ? (categoryName ?? category) : 'All products';
  const unknownCategory = category && categories.length > 0 && !categoryName;
  const hasFilters = category || urlSearch || sort !== 'name';
  const list = products.data?.items ?? [];
  const paging = products.data;

  return (
    <section aria-labelledby="products-title">
      <title>{`${heading} · RedStarVibe`}</title>
      <h1 id="products-title">{heading}</h1>

      <div className={styles.toolbar}>
        <label>
          Search
          <input type="search" value={searchBox} maxLength={100} placeholder="name or description"
            onChange={(e) => onSearchChange(e.target.value)} />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => updateParams({ [PRODUCT_PARAMS.sort]: e.target.value === 'name' ? '' : e.target.value, [PRODUCT_PARAMS.page]: '' })}>
            {PRODUCT_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {hasFilters && (
          <button type="button" className={styles.button} onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {unknownCategory && <p role="alert" className={styles.error}>There is no category called "{category}".</p>}
      {products.error ? (
        <div role="alert" className={styles.error}>
          Could not load products: {products.error.message}{' '}
          <button type="button" className={styles.button} onClick={products.reload}>Retry</button>
        </div>
      ) : (
        <>
          <p className={styles.muted} aria-live="polite">
            {products.loading ? 'Loading…' : `${paging.totalCount} product${paging.totalCount === 1 ? '' : 's'}`}
          </p>
          <ul className={styles.grid} aria-label="Products" aria-busy={products.loading}>
            {list.map((p) => (
              <li key={p.id} className={styles.cardShell}>
                {/* state: remember where we came from, so the detail page can link back to THESE results */}
                <Link to={productPath(p.id)} state={{ from: `${location.pathname}${location.search}` }} className={styles.card}>
                  {p.imageUrl && <img className={styles.thumb} src={imageSrc(p.imageUrl)} alt="" loading="lazy" width="320" height="180" />}
                  <span className={styles.badge}>{p.categoryName}</span>
                  <strong>{p.name}</strong>
                  <span className={styles.muted}>{p.description}</span>
                  <span className={styles.price}>{formatPrice(p.price)}</span>
                </Link>
                {/* Outside the <Link>: a button inside a link is invalid HTML and confusing for screen readers */}
                <AddToCartButton product={p} />
              </li>
            ))}
          </ul>
          {!products.loading && list.length === 0 && <p className={styles.muted}>No products match these filters.</p>}
          {paging?.totalPages > 1 && (
            <nav className={styles.pager} aria-label="Pagination">
              <button type="button" className={styles.button} disabled={!paging.hasPrevious}
                onClick={() => updateParams({ [PRODUCT_PARAMS.page]: page - 1 > 1 ? String(page - 1) : '' })}>← Previous</button>
              <span>Page {paging.page} of {paging.totalPages}</span>
              <button type="button" className={styles.button} disabled={!paging.hasNext}
                onClick={() => updateParams({ [PRODUCT_PARAMS.page]: String(page + 1) })}>Next →</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
