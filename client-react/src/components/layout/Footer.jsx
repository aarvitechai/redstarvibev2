import styles from './Layout.module.css';

// Rendering must be PURE: the same props must give the same output.
// new Date() changes every call, so compute it once, outside the component.
const YEAR = new Date().getFullYear();

export default function Footer({ appName }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>© {YEAR} {appName}</div>
    </footer>
  );
}
