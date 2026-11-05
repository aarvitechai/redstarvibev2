import { getInitials } from '../../utility/format';
import styles from './Students.module.css';

export default function Avatar({ name }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
