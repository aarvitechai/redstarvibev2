import { Suspense, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import { Outlet, useLocation } from 'react-router';
import ActivityBar from './ActivityBar';
import ErrorBoundary from './ErrorBoundary';
import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

// A LAYOUT ROUTE: it renders the shell once, and <Outlet /> is where the matched child route appears.
// Navigating between pages swaps only the Outlet; the header, footer and theme state stay mounted.
export default function Layout({ appName = 'RedStarVibe' }) {
  const { pathname } = useLocation();

  // A real page load starts at the top, so a client-side navigation should too.
  // Only the PATH counts: changing filters (?category=...) keeps the scroll position.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <ActivityBar />
      <Header appName={appName} />
      <main className={styles.main}>
        {/* key: a new page gets a fresh boundary (an error on one page doesn't stick to the next) */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<p role="status">Loading…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      {/* Toasts: short, non-blocking messages ("Saved", "Someone else changed this order") */}
      <ToastContainer position="bottom-right" autoClose={4000} newestOnTop theme="colored" />
      <Footer appName={appName} />
    </div>
  );
}
