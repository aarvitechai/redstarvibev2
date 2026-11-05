import { useDispatch, useSelector } from 'react-redux';
import { amountAdded, decremented, incremented, reset, selectCount } from '../../store/counterSlice';
import styles from '../../components/counter/Counter.module.css';

// Redux in one minute, all visible here:
//   ACTION   a plain object describing what happened      { type: 'counter/amountAdded', payload: 5 }
//   DISPATCH sends the action to the store                dispatch(amountAdded(5))
//   REDUCER  (state, action) => newState, pure            counterSlice.reducer
//   SELECTOR reads a piece of state                       useSelector(selectCount)
// Mount this component twice and both copies stay in sync, because the state lives in the store, not here.
export default function ReduxCounter() {
  const count = useSelector(selectCount);
  const dispatch = useDispatch();

  return (
    <div className={styles.counter}>
      <output className={styles.value} aria-label="redux count">{count}</output>
      <div className={styles.row}>
        <button type="button" onClick={() => dispatch(decremented())}>− 1</button>
        <button type="button" onClick={() => dispatch(incremented())}>+ 1</button>
        <button type="button" onClick={() => dispatch(amountAdded(5))}>+ 5</button>
        <button type="button" onClick={() => dispatch(reset())}>Reset</button>
      </div>
    </div>
  );
}
