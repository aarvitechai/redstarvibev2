import { useEffect, useId, useRef } from 'react';
import styles from './Admin.module.css';

// An ACCESSIBLE modal: role="dialog" + aria-modal + a labelled title, focus moved inside on open and given back on
// close, and Escape to close. (Native <dialog>.showModal() would do most of this, but jsdom, our test DOM, lacks it.)
export default function Modal({ title, onClose, children }) {
  const titleId = useId();
  const panel = useRef(null);

  // Keep the LATEST onClose in a ref. Putting onClose itself in the effect's dependency array was a bug (caught by a
  // test): parents pass a new inline function on every render, so the effect re-ran on every keystroke, and its
  // cleanup moved the focus away while the admin was typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement; // remember who opened us
    // Focus the first FIELD (not the ✕ button in the header); fall back to the first button for dialogs without fields
    const target = panel.current?.querySelector('input, select, textarea') ?? panel.current?.querySelector('form button, div > button');
    target?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.(); // give focus back, so keyboard users don't get lost
    };
  }, []); // ONCE: on open and on close

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}>
      <div ref={panel} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.modalHead}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={styles.iconButton} onClick={() => onCloseRef.current()} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}
