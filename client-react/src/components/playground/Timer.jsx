import { useEffect, useState } from 'react';
import styles from '../counter/Counter.module.css';

// A stopwatch: useEffect WITH CLEANUP.
// Without the cleanup, every Start would add ANOTHER interval, and they would keep running after unmount (a leak).
export default function Timer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined; // nothing to set up, so nothing to clean up

    const id = setInterval(() => setSeconds((s) => s + 1), 1000); // functional update: never stale
    return () => clearInterval(id); // runs on Stop, and on unmount
  }, [running]);

  return (
    <div className={styles.counter}>
      <output className={styles.value} aria-label="seconds">{seconds}s</output>
      <div className={styles.row}>
        <button type="button" onClick={() => setRunning((r) => !r)}>{running ? 'Stop' : 'Start'}</button>
        <button type="button" onClick={() => setSeconds(0)} disabled={seconds === 0}>Reset</button>
      </div>
    </div>
  );
}
