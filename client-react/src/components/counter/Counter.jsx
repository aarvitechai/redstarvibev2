import { useState } from 'react';
import styles from './Counter.module.css';

// HTML min/max attributes DON'T limit what ends up in state; enforce the range in code.
const clampStep = (raw) => Math.min(10, Math.max(1, Math.trunc(Number(raw)) || 1));

// useState basics, and WHY functional updates exist.
export default function Counter({ initial = 0, min = 0 }) {
  const [count, setCount] = useState(initial);
  const [step, setStep] = useState(1);

  // setCount does NOT change `count` immediately. It schedules a re-render.
  // Inside this click handler `count` is a fixed snapshot, so three calls all compute snapshot + 1.
  function addThreeWrong() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1); // the result is +1, not +3
  }

  // A functional update receives the LATEST pending value, so the calls chain correctly.
  function addThreeRight() {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1); // +3
  }

  const atMin = count - step < min;

  return (
    <div className={styles.counter}>
      <output className={styles.value} aria-label="count">{count}</output>
      {/* Conditional rendering: text that depends on state */}
      <p className={styles.hint}>{count % 2 === 0 ? 'Even' : 'Odd'}{count >= 10 && ' · double digits!'}</p>

      <div className={styles.row}>
        <button type="button" onClick={() => setCount((c) => c - step)} disabled={atMin}>− {step}</button>
        <button type="button" onClick={() => setCount((c) => c + step)}>+ {step}</button>
        <button type="button" onClick={() => setCount(initial)}>Reset</button>
      </div>

      <label className={styles.row}>
        Step
        <input type="number" min="1" max="10" value={step}
          onChange={(e) => setStep(clampStep(e.target.value))} />
      </label>

      <div className={styles.row}>
        <button type="button" onClick={addThreeWrong}>+3 (wrong)</button>
        <button type="button" onClick={addThreeRight}>+3 (functional)</button>
      </div>
    </div>
  );
}
