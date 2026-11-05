import Header from './Header';
import Footer from './Footer';
import styles from './Layout.module.css';

// Composition: Layout doesn't know what the page is. It renders whatever is passed as `children`.
// Phase 7 replaces {children} with React Router's <Outlet />.
export default function Layout({ appName = 'RedStarVibe', children }) {
  return (
    <div className={styles.shell}>
      <Header appName={appName} />
      <main className={styles.main}>{children}</main>
      <Footer appName={appName} />
    </div>
  );
}
