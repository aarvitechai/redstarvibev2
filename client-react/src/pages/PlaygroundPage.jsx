import Counter from '../components/counter/Counter';
import Timer from '../components/playground/Timer';
import KeysDemo from '../learning/phase-03/KeysDemo';
import MemoDemo from '../learning/phase-04/MemoDemo';
import ReduxCounter from '../learning/phase-09/ReduxCounter';

// Phase 3, 4 and 9 learning demos, at /playground.
export default function PlaygroundPage() {
  return (
    <section>
      <title>Playground · RedStarVibe</title>
      <h1>Playground</h1>
      <h3>Counter: useState and functional updates</h3>
      <Counter />
      <h3>Keys: index vs id</h3>
      <KeysDemo />
      <h3>Timer: useEffect cleanup</h3>
      <Timer />
      <h3>memo / useCallback: measure re-renders</h3>
      <MemoDemo />
      <h3>Redux counter: two copies, one store</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <ReduxCounter />
        <ReduxCounter />
      </div>
    </section>
  );
}
