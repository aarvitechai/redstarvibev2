import styles from './Students.module.css';

// A SIBLING of the list and the form. It has no state: it reads the same lifted state through props,
// so it updates automatically when the form adds a student or a card toggles one.
export default function StudentStats({ students }) {
  const active = students.filter((s) => s.isActive).length;

  return (
    <p className={styles.stats} aria-live="polite">
      <strong>{students.length}</strong> students · <strong>{active}</strong> active ·{' '}
      <strong>{students.length - active}</strong> inactive
    </p>
  );
}
