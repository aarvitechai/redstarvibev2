# Phase 4: Hooks Beyond State

**Goal:** side effects done right. Talk to the real API, cancel stale requests, clean up timers, share a theme app-wide, and memoize only what has been measured.

## What was built

| Piece | React | Angular | Backend |
| --- | --- | --- | --- |
| API call | `services/studentsApi.js` (fetch + AbortSignal) | `features/students/students-api.ts` (HttpClient) | `GET /api/students?search=` |
| Data hook / service | `hooks/useStudents.js` | `StudentsApi` + an RxJS pipeline | `InMemoryStudentService.GetAll(search)` |
| Debounce | `hooks/useDebouncedValue.js` | `debounceTime(300)` | — |
| Cancel stale requests | `AbortController` in the effect cleanup | `switchMap` | — |
| Live page | `pages/DirectoryPage.jsx` | `features/directory/directory-page.ts` | — |
| Timer + cleanup | `components/playground/Timer.jsx` | `features/playground/timer.ts` (`effect` + `onCleanup`) | — |
| App-wide value | `context/ThemeProvider.jsx` + `useTheme()` (moved to a Redux `themeSlice` in Phase 9) | `core/theme/theme.service.ts` (DI singleton) | — |
| Memo demo | `learning/phase-04/MemoDemo.jsx` | (signals + OnPush cover this) | — |

## Concept map

| Concept | React | Angular |
| --- | --- | --- |
| Run a side effect | `useEffect(fn, deps)` | `effect(fn)`: dependencies are tracked automatically |
| Clean up | `return () => ...` from the effect | `onCleanup(() => ...)` |
| Once after the first render | `useEffect(fn, [])` | `afterNextRender(fn)` |
| DOM handle | `useRef` + `ref={x}` | `viewChild('x')` + `#x` |
| Value without a re-render | `useRef().current` | a plain class field |
| Cached computed value | `useMemo` | `computed` |
| Stable function | `useCallback` | not needed: methods are stable |
| Skip a child render | `React.memo` | `OnPush` + signal inputs |
| Shared app-wide value | Context + Provider | `@Injectable({ providedIn: 'root' })` |
| Reusable stateful logic | custom hook `useX()` | service or a function using `inject()` |
| Cancel an HTTP request | `AbortController.abort()` | unsubscribe (`switchMap` does it) |

## The three forms of the dependency array
```js
useEffect(fn);            // NO array: runs after EVERY render       (MemoDemo's render counter)
useEffect(fn, []);        // EMPTY:    runs once, after mount         (focus the search box)
useEffect(fn, [a, b]);    // LIST:     runs on mount + when a/b change (useStudents, Timer, debounce)
```
The cleanup runs **before the next run** and **on unmount**.

## Race conditions, and the fix
The user types `co` and then `comp`. If the `co` request is slower, it arrives **last** and overwrites the correct results.
- **React:** create an `AbortController` per effect run, and call `abort()` in the cleanup. Ignore `AbortError`.
- **Angular:** `switchMap` unsubscribes from the previous inner Observable, which cancels the HTTP request.
- **Tests:** both clients have a test where the slow old request is checked to be **cancelled** and the newest result wins.

## Lint lessons from this phase
1. **No `setState` at the top of an effect.** `setLoading(true)` inside `useEffect` costs an extra render. `useStudents` derives `loading` instead: the stored result remembers which request it answers, and `loading = result.key !== requestKey`. Old results stay visible while new ones load.
2. **Don't read or write refs during render.** The render counter moved into a `useEffect` with no dependency array.
3. **`useMemo` on the context value**, so the consumers don't re-render whenever the provider does.

## Backend notes
- Search is a **query-string** parameter, so the same endpoint serves list and search. It's trimmed and case-insensitive, and it matches name, email or course.
- `[FromQuery, StringLength(100)]`: validation works on query parameters too. Bad input returns **400 + envelope**.
- A live check confirmed that CORS answers only `localhost:5173` and `localhost:4200`; other origins get no CORS header.

## Run it
```bash
cd server && dotnet run --project Server.Api --launch-profile http
cd client-react && npm run dev          # Directory section: type "comp"
cd client-angular && npm start
```
Stop the API and reload: the Directory shows the **error + Retry** state.

## Checkpoint: answer these out loud before Phase 5

**Q1. What are the three forms of the dependency array?**
No array: after every render. `[]`: once after mount, plus cleanup on unmount. `[a, b]`: after mount and whenever `a` or `b` changes (compared with `Object.is`). Leaving out a value the effect uses leads to stale data, so let the linter keep the list honest.

**Q2. `useRef` vs `useState`?**
Both keep a value across renders. **Changing state re-renders** the component and is what the UI shows. **Changing `ref.current` does not re-render.** Use a ref for things the UI doesn't display: DOM nodes, timer ids, previous values, counters. Don't read or write refs during render.

**Q3. `useMemo` vs `useCallback`?**
`useMemo(() => compute(), deps)` caches a **value**. `useCallback(fn, deps)` caches a **function** and is the same as `useMemo(() => fn, deps)`. `useCallback` only pays off when the function goes to a `memo` child or into a dependency array. MemoDemo shows that `memo` plus an inline function still re-renders. **Measure first** with the React Profiler; memoizing everything adds cost and complexity.

**Self-check:**
- Why does `useStudents` abort on unmount as well as on change?
- Why does the debounce work just by clearing the timer in the cleanup?
- What would break if `ThemeProvider` passed `{ theme, toggleTheme }` without `useMemo`?
- In Angular, which operator gives the AbortController behaviour, and why does `debounceTime` come before it?
