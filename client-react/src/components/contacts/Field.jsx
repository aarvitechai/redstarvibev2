import { useId } from 'react';
import styles from './Contacts.module.css';

// A labelled input with an accessible error message. All three forms use it.
// React 19 passes `ref` as a normal prop, so react-hook-form's {...register('name')} works without forwardRef.
export default function Field({ label, error, hint, ...inputProps }) {
  const id = useId(); // a unique, stable id, so label/aria links never clash between forms
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined}
        {...inputProps}
      />
      {hint && !error && <small id={hintId} className={styles.hint}>{hint}</small>}
      {error && <small id={errorId} className={styles.fieldError} role="alert">{error}</small>}
    </div>
  );
}
