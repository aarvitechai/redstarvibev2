import { useEffect, useMemo, useRef, useState } from 'react';
import StudentList from '../components/students/StudentList';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useStudents } from '../hooks/useStudents';
import styles from '../components/students/Students.module.css';

// Phase 4: the FIRST page that talks to the real API (GET /api/students?search=).
// Read-only; writes go through the API in Phase 6.
export default function DirectoryPage() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { students, loading, error, reload } = useStudents(debouncedSearch);

  // useRef #1: a handle to a DOM element. Changing a ref does NOT re-render.
  const searchInput = useRef(null);
  useEffect(() => {
    searchInput.current?.focus(); // runs once after the first render ([] = mount only)
  }, []);

  // useMemo: recompute the sorted copy only when `students` or `sortBy` change, not on every keystroke.
  // For 4 students it's unnecessary, but this is the pattern to use once a profiler shows sorting is slow.
  const sorted = useMemo(
    () => students.toSorted((a, b) => (sortBy === 'year' ? a.year - b.year : a.name.localeCompare(b.name))),
    [students, sortBy],
  );

  return (
    <section>
      <title>Directory · RedStarVibe</title>
      <h1>Directory (live API)</h1>

      <div className={styles.toolbar}>
        <label>
          Search
          <input
            ref={searchInput}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="name, email or course"
            maxLength={100}
          />
        </label>
        <label>
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="year">Year</option>
          </select>
        </label>
      </div>

      {/* The three states every async UI needs: loading, error, data */}
      {error ? (
        <div role="alert" className={styles.error}>
          Could not load students: {error}{' '}
          <button type="button" className={styles.button} onClick={reload}>Retry</button>
        </div>
      ) : (
        <>
          <p className={styles.stats} aria-live="polite">
            {loading ? 'Loading…' : `${sorted.length} result${sorted.length === 1 ? '' : 's'}`}
          </p>
          <div aria-busy={loading} style={{ opacity: loading ? 0.6 : 1 }}>
            <StudentList students={sorted} emptyMessage={loading ? '' : `No students match "${debouncedSearch}".`} />
          </div>
        </>
      )}
    </section>
  );
}
