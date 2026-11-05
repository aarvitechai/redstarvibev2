import { Component } from 'react';
import styles from '../../pages/products/Products.module.css';

// An ERROR BOUNDARY catches errors thrown while RENDERING the components inside it, and shows a fallback instead of
// a blank white page. It has to be a class component (there's no hook for this yet).
// It does NOT catch errors in event handlers or async code; those are handled where they happen (try/catch, toasts).
// Layout gives it key={pathname}, so navigating to another page resets it.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In production this is where you'd report to a logging service (Phase 15)
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section role="alert" className={styles.notFound}>
        <p className={styles.code403}>Oops</p>
        <h1>Something went wrong on this page</h1>
        <p className={styles.muted}>The rest of the app still works. Try again, or go to another page.</p>
        <button type="button" className={styles.button} onClick={() => this.setState({ error: null })}>Try again</button>
      </section>
    );
  }
}
