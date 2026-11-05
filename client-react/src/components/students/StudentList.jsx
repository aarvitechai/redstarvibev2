import StudentCard from './StudentCard';
import styles from './Students.module.css';

export default function StudentList({ students, onToggle, onRemove, emptyMessage = 'No students yet.' }) {
  if (students.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.grid}>
      {/* key = a stable, unique id from the data (NOT the array index). React uses it to match items between renders. */}
      {students.map((student) => (
        <li key={student.id}>
          <StudentCard student={student} onToggle={onToggle} onRemove={onRemove} />
        </li>
      ))}
    </ul>
  );
}
