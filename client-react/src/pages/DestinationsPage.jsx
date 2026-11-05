import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import DestinationCard from '../components/destinations/DestinationCard';
import DestinationForm from '../components/destinations/DestinationForm';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../hooks/useAuth';
import {
  DEFAULT_PAGE_SIZE,
  useAddDestinationMutation,
  useGetDestinationsQuery,
  usePrefetch,
} from '../store/api/destinationsApi';
import styles from './products/Products.module.css';

// Project 5: Destination Manager with RTK Query.
// Compare with Phase 4's useStudents: there's no useEffect, no AbortController, no loading/error useState,
// and no "reload the list after saving". The query hook and the tags handle all of it.
export default function DestinationsPage() {
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const search = params.get('q') ?? '';
  const visited = params.get('visited') ?? '';

  // isLoading: the FIRST load (nothing cached yet). isFetching: ANY request, including background refetches.
  const { data, isLoading, isFetching, error, refetch } = useGetDestinationsQuery({ page, search, visited });
  const [addDestination] = useAddDestinationMutation();
  const prefetch = usePrefetch('getDestinations');

  // Prefetch the NEXT page while the user reads this one, so clicking "Next" shows it instantly from the cache
  useEffect(() => {
    if (data?.hasNext) prefetch({ page: page + 1, search, visited });
  }, [data?.hasNext, page, search, visited, prefetch]);

  const update = (changes) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, String(v));
        else next.delete(k);
      }
      return next;
    });

  // Search box: local while typing, written to the URL after a pause (the same pattern as the Phase 7 product filter)
  const [typed, setTyped] = useState({ forUrl: search, value: search });
  const box = typed.forUrl === search ? typed.value : search;
  const timer = useRef(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function onSearch(value) {
    setTyped({ forUrl: search, value });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyped({ forUrl: value.trim(), value });
      update({ q: value.trim(), page: '' }); // a new search starts again at page 1
    }, 300);
  }

  const from = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? from + data.items.length - 1 : 0;

  return (
    <section aria-labelledby="destinations-title">
      <title>Destinations · RedStarVibe</title>
      <h1 id="destinations-title">Destinations</h1>

      {isAuthenticated ? (
        <DestinationForm label="Add destination" submitLabel="Add destination" onSubmit={(values) => addDestination(values).unwrap()} />
      ) : (
        <p className={styles.muted}><Link to={ROUTES.login} state={{ from: { pathname: ROUTES.destinations } }}>Log in</Link> to add or edit destinations.</p>
      )}

      <div className={styles.toolbar}>
        <label>
          Search
          <input type="search" value={box} onChange={(e) => onSearch(e.target.value)} placeholder="name or country" maxLength={100} />
        </label>
        <label>
          Show
          <select value={visited} onChange={(e) => update({ visited: e.target.value, page: '' })}>
            <option value="">All</option>
            <option value="false">Not visited yet</option>
            <option value="true">Visited</option>
          </select>
        </label>
      </div>

      {error ? (
        <div role="alert" className={styles.error}>
          Could not load destinations: {error.message}{' '}
          <button type="button" className={styles.button} onClick={refetch}>Retry</button>
        </div>
      ) : isLoading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          <p className={styles.muted} aria-live="polite">
            {data.totalCount === 0 ? 'No destinations match.' : `Showing ${from}–${to} of ${data.totalCount}`}
            {isFetching && ' · Updating…'}
          </p>
          <ul className={styles.grid} aria-label="Destinations" aria-busy={isFetching}>
            {data.items.map((d) => <DestinationCard key={d.id} destination={d} canEdit={isAuthenticated} />)}
          </ul>
          {data.totalPages > 1 && (
            <nav className={styles.pager} aria-label="Pagination">
              <button type="button" className={styles.button} disabled={!data.hasPrevious} onClick={() => update({ page: page - 1 > 1 ? page - 1 : '' })}>
                ← Previous
              </button>
              <span>Page {data.page} of {data.totalPages}</span>
              <button type="button" className={styles.button} disabled={!data.hasNext} onClick={() => update({ page: page + 1 })}>
                Next →
              </button>
            </nav>
          )}
        </>
      )}
      <p className={styles.muted}>Showing up to {DEFAULT_PAGE_SIZE} per page.</p>
    </section>
  );
}
