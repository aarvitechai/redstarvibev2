import { memo, useCallback, useEffect, useRef, useState } from 'react';

// MEASURE BEFORE YOU MEMOIZE. Each child shows how many times it has rendered.
// Click "Unrelated +1": it changes only parent state that the children don't use.
//  - Plain child:                     re-renders every time (the default: a parent render renders its children)
//  - memo child + inline callback:    STILL re-renders, because () => {} is a new function on each render, so the props changed
//  - memo child + useCallback:        skips the render, because the props are the same references as last time
// (In real apps, measure with the React DevTools Profiler instead of counters like this one.)

function RenderCount({ label, onPick }) {
  // useRef: a value that survives re-renders WITHOUT causing one (unlike useState)
  const renders = useRef(0);
  const output = useRef(null); // a ref to a DOM node

  // NO dependency array: runs after EVERY render. Refs are read and written here, outside render.
  // Writing the count straight into the DOM avoids setState, which would cause yet another render.
  useEffect(() => {
    renders.current += 1;
    output.current.textContent = String(renders.current);
  });

  return (
    <li>
      {label}: <strong data-testid={label} ref={output}>0</strong> renders{' '}
      <button type="button" onClick={onPick}>pick</button>
    </li>
  );
}

const MemoRenderCount = memo(RenderCount); // re-render only when the props change (shallow compare)

export default function MemoDemo() {
  const [unrelated, setUnrelated] = useState(0);
  const [picked, setPicked] = useState(0);

  // useCallback = useMemo for functions: the SAME function reference until the dependencies change
  const stablePick = useCallback(() => setPicked((p) => p + 1), []);

  return (
    <div>
      <button type="button" onClick={() => setUnrelated((u) => u + 1)}>Unrelated +1 ({unrelated})</button>
      <span> · picked {picked}</span>
      <ul>
        <RenderCount label="plain" onPick={stablePick} />
        <MemoRenderCount label="memo + inline fn" onPick={() => setPicked((p) => p + 1)} />
        <MemoRenderCount label="memo + useCallback" onPick={stablePick} />
      </ul>
    </div>
  );
}
