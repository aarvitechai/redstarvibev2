import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import ActivityBar from './ActivityBar';
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
        <Outlet />
      </main>
      <Footer appName={appName} />
    </div>
  );
}
