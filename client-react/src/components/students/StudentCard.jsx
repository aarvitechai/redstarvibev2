import Avatar from './Avatar';
import Card from './Card';
import styles from './Students.module.css';

// Destructure props in the signature. NEVER assign to props (student.name = ... is a bug):
// the data belongs to the parent, so changes must flow down from there.
export default function StudentCard({ student }) {
  const { name, email, course, year, isActive } = student;

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
      {/* JSX rule: a ternary is an expression, so it can go inside { } (an if statement can't) */}
      <span className={isActive ? styles.badgeActive : styles.badgeInactive}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    </Card>
  );
}
