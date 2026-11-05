import { useId } from 'react';
import styles from './Orders.module.css';

// An ACCESSIBLE star rating: a group of radio buttons styled as stars, so it works with the keyboard
// (Tab into it, then the arrow keys) and screen readers announce "3 stars, 3 of 5".
export default function StarRating({ value, onRate, disabled, label }) {
  const name = useId();
  return (
    <fieldset className={styles.stars} disabled={disabled}>
      <legend className={styles.srOnly}>{label}</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= (value ?? 0) ? styles.starOn : styles.starOff}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onRate(n)} className={styles.srOnly} />
          <span aria-hidden="true">★</span>
          <span className={styles.srOnly}>{n} star{n === 1 ? '' : 's'}</span>
        </label>
      ))}
    </fieldset>
  );
}
