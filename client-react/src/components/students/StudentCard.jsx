import Avatar from './Avatar';
import Card from './Card';
import styles from './Students.module.css';

// Destructure props in the signature. NEVER assign to props (student.name = ... is a bug):
// the data belongs to the parent, so changes must flow down from there.
// Events flow UP instead: the card calls onToggle / onRemove, and the PARENT decides what changes.
export default function StudentCard({ student, onToggle, onRemove }) {
  const { id, name, email, course, year, isActive } = student;

  return (
    <Card aria-label={name}>
      <div className={styles.cardHead}>
        <Avatar name={name} />
        <div>
          <h3 className={styles.name}>{name}</h3>
          <a className={styles.email} href={`mailto:${email}`}>{email}</a>
        </div>
      </div>
      <dl className={styles.meta}>
        <div><dt>Course</dt><dd>{course}</dd></div>
        <div><dt>Year</dt><dd>{year}</dd></div>
      </dl>
      <div className={styles.cardFoot}>
        {/* JSX rule: a ternary is an expression, so it can go inside { } (an if statement can't) */}
        <span className={isActive ? styles.badgeActive : styles.badgeInactive}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
        {/* Render the buttons only when the parent passed handlers (a read-only list passes none) */}
        {(onToggle || onRemove) && (
          <div className={styles.actions}>
            {onToggle && (
              // Pass a FUNCTION: onClick={() => onToggle(id)}. Writing onClick={onToggle(id)} would call it during render.
              <button type="button" className={styles.button} onClick={() => onToggle(id)}>
                {isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
            {onRemove && (
              <button type="button" className={styles.dangerButton} onClick={() => onRemove(id)}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
