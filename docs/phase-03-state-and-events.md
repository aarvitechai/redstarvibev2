# Phase 3: State and Events (Project 1, part 2)

**Goal:** make the UI change. A counter, a student list you can add to, toggle and remove from, and state lifted so that sibling components stay in sync.

## What was built

| Piece | React | Angular | Backend |
| --- | --- | --- | --- |
| Counter | `components/counter/Counter.jsx` (`useState`) | `features/playground/counter.ts` (`signal`, `linkedSignal`) | — |
| List rules | `components/students/studentsReducer.js` (`useReducer`) | `features/students/students.state.ts` (reducer + `signal.update`) | `Services/InMemoryStudentService.cs` |
| Lifted state | `pages/StudentsPage.jsx` | `features/students/students-page.ts` | — |
| Siblings | `AddStudentForm`, `StudentStats`, `StudentList` | `add-student-form`, `student-stats`, `student-list` | — |
| Events up | `onToggle` / `onRemove` / `onAdd` props | `output()`: `(toggled)`, `(removed)`, `(added)` | — |
| Keys demo | `learning/phase-03/KeysDemo.jsx` | `features/playground/keys-demo.ts` | — |
| Write API | — | — | `POST`, `PUT /{id}`, `DELETE /{id}` on `/api/students` |

The clients still keep state **in memory** (a reload resets it). They call the new API in Phase 4 (`useEffect`) and Phase 6 (Axios); Angular will use HttpClient.

## Concept map

| Concept | React | Angular |
| --- | --- | --- |
| Local state | `const [x, setX] = useState(0)` | `x = signal(0)` |
| Update from current | `setX(prev => prev + 1)` | `x.update(prev => prev + 1)` |
| Read after set | **stale** until the next render | **immediate**: `x()` returns the new value |
| Many related changes | `useReducer(reducer, init)` + `dispatch` | `signal` + `update(s => reducer(s, action))` |
| Derived value | compute it during render | `computed(() => ...)` |
| State derived from an input | — | `linkedSignal(() => this.initial())` |
| Child → parent | callback prop `onRemove(id)` | `removed = output<number>()`, `removed.emit(id)` |
| Event handler | `onClick={() => fn(id)}` | `(click)="fn(id)"` |
| List identity | `key={item.id}` | `track item.id` |

## Lifting state up
```
StudentsPage  (owns: students, activeOnly)
├── StudentStats   ← students            (reads only)
├── AddStudentForm → onAdd(student)      (owns only its draft)
└── StudentList    ← visible students
    └── StudentCard → onToggle(id) / onRemove(id)
```
Rule: put state in the **closest common parent** of every component that needs it. Data goes **down** as props or inputs; changes come **up** as callbacks or outputs.

## Backend notes
- **Input DTOs** (`CreateStudentDto`, `UpdateStudentDto`) have no `Id`, and `Create` has no `IsActive` either. The server sets those fields, so a client can't over-post them. A test proves this.
- **Validation**: DataAnnotations (`[Required]`, `[EmailAddress]`, `[Range]`). `[ApiController]` returns **400** automatically, and `Program.cs` wraps those errors in the `ApiResponse` envelope.
- **Status codes**: 201 + `Location` (create), 200 (update), 204 (delete), 400 (invalid), 404 (missing), 409 (duplicate email).
- The **singleton** service is now writable, so it takes a `lock`. A test fires 200 concurrent creates and checks that every id is unique.
- `GetAll` returns a **snapshot**, so callers can't change the internal list.

## Bugs that tests caught in this phase
- **Clamping the Step value**: the `min`/`max` HTML attributes do **not** limit the value in state. The Counter typed "15" into a field meant for 1–10. Fixed by clamping in code. The server-side version of the same lesson: always validate on the server.
- **Output names**: Angular outputs named `toggle`/`remove` share names with native DOM events, so they were renamed to `toggled`/`removed`.

## Checkpoint: answer these out loud before Phase 4

**Q1. Why is `setState` "async"?**
`setState` doesn't change the variable. It **schedules** a re-render with the new value. Inside the current handler, `count` is a fixed snapshot from this render, so `setCount(count + 1)` three times gives +1. React also **batches** updates from one event into a single render for performance. When the next value depends on the previous one, use the functional form: `setCount(c => c + 1)`. *(Angular signals are different: `set` is synchronous, so `count()` returns the new value at once. The Counter demo shows both.)*

**Q2. Why do index keys break?**
A key tells React (or `track` tells Angular) **which item is which** between renders. With the index as the key, inserting at the top shifts every index. React then thinks row 0 is the same row as before, keeps its DOM, input text and component state, and shows the new item's data in it. The typed text ends up on the wrong item. The KeysDemo test proves it. Use a stable id from the data. The index is only safe for a static list that never reorders.

**Self-check:**
- Why is `visible` computed instead of stored in its own `useState`?
- Why does the form own the draft, while the page owns the list?
- What's wrong with `onClick={onRemove(id)}`?
- Why does `studentsReducer` throw on an unknown action type?
- Why does the API return **409** for a duplicate email, and not 400?
