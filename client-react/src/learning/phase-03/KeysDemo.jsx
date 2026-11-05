import { useState } from 'react';

// WHY INDEX KEYS BREAK. Type something into the first row's box, then click "Add to top".
//  - key={index}: React thinks row 0 is the "same" row as before, so it keeps that row's DOM <input>
//    (and your typed text), but shows the NEW label next to it. The text now sits on the wrong item.
//  - key={item.id}: React moves the DOM row together with its item, so the text stays with "Asha".
// The same goes for component state, focus and animations: they all stick to the key.

const START = [
  { id: 1, label: 'Asha' },
  { id: 2, label: 'Ravi' },
];

function NoteList({ title, useIndexKey }) {
  const [items, setItems] = useState(START);
  const [nextId, setNextId] = useState(3);

  function addToTop() {
    setItems((prev) => [{ id: nextId, label: `New #${nextId}` }, ...prev]);
    setNextId((n) => n + 1);
  }

  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <button type="button" onClick={addToTop}>Add to top</button>
      <ul>
        {items.map((item, index) => (
          <li key={useIndexKey ? index : item.id}>
            {item.label}: <input aria-label={`note for ${item.label}`} placeholder="type a note" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function KeysDemo() {
  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <NoteList title="key={index} (buggy)" useIndexKey />
      <NoteList title="key={item.id} (correct)" />
    </div>
  );
}
