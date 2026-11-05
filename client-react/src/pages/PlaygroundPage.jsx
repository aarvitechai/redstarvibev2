import Counter from '../components/counter/Counter';
import Timer from '../components/playground/Timer';
import KeysDemo from '../learning/phase-03/KeysDemo';
import MemoDemo from '../learning/phase-04/MemoDemo';

// Phase 3 and 4 learning demos, at /playground.
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
    </section>
  );
}
