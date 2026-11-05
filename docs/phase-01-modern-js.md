# Phase 1: Modern JavaScript (plus its TypeScript and C# equivalents)

Each topic is written three times, and each version has its own tests. Read them side by side.

| Topic | React (JS) | Angular (TS) | Backend (C#) |
| --- | --- | --- | --- |
| let/const, arrows, destructuring, spread/rest, modules | `client-react/src/learning/phase-01/basics.js` | `client-angular/src/app/learning/phase-01/basics.ts` | `server/Server.Tests/Learning/Phase01/Phase01Concepts.cs` (`Basics`) |
| map/filter/find/reduce/some/every, sort | `arrays.js` | `arrays.ts` | `Phase01Concepts.cs` (`Linq`) |
| truthy/falsy, `??`, `?.`, references | `values.js` | `values.ts` | `Phase01Concepts.cs` (`Values`) |
| Promises, async/await | `async.js` | `async.ts` (+ Observables) | `Phase01Concepts.cs` (`AsyncDemo`) |
| **Practice:** immutable users | `users.js` | `users.ts` | `UserListOps.cs` |
| Tests | `phase01.test.js` | `phase01.spec.ts` | `Phase01Tests.cs` |

## Run the tests
```bash
cd client-react   && npm test            # Vitest, watch mode
cd client-angular && npm test            # Vitest through the Angular builder
cd server         && dotnet test --filter "FullyQualifiedName~Phase01"
```

## Concept map

| JS | TS adds | C# equivalent |
| --- | --- | --- |
| `const` / `let` (never `var`) | `readonly` on properties and arrays | `readonly`, `const`; C# `var` = type inference only |
| `(a, b) => a + b` | parameter and return types | lambdas, `=>` expression-bodied members |
| `const { a, b } = obj` | typed destructuring | tuple / record deconstruction |
| `[...arr, x]`, `{ ...obj, k: v }` | `Partial<T>`, `Omit<T>` | `[.. list, x]`, `record with { K = v }` |
| `map` / `filter` / `find` | `T \| undefined` return from `find` | `Select` / `Where` / `FirstOrDefault` |
| `reduce` | generic accumulator `reduce<T>` | `Aggregate`, `Sum`, `GroupBy` |
| `some` / `every` | | `Any` / `All` |
| `sort` **mutates** | `readonly T[]` blocks `.sort()` at compile time | `List.Sort` mutates; `OrderBy` returns a new sequence |
| truthy/falsy | same as JS | none: conditions must be `bool` |
| `Promise.all` / `allSettled` | `Promise<T>`, `Observable<T>` | `Task.WhenAll`; `CancellationToken` = AbortController |

## Things to watch for
1. `{count && <Badge/>}` renders **0** when count is 0. Use `count > 0 ? <Badge/> : null`.
2. `qty || 1` turns a real `0` into `1`. Use `qty ?? 1`.
3. Spread and `with` are **shallow**. Copy every level you change.
4. `sort` mutates the original. Use `[...a].sort()` or `a.toSorted()`.
5. `from(promise)` in RxJS is eager. `defer(() => promise)` is lazy.
6. LINQ is lazy: a query runs each time you enumerate it, so call `.ToList()` once.

## Checkpoint: answer these out loud before Phase 2

**Q1. Why is `arr.push(x)` wrong for state?**
It changes the existing array in place and keeps the same reference. React (`Object.is`), Angular signals and OnPush, and Redux all decide "did it change?" by comparing references. So they may skip the update, and any other code holding that array changes unexpectedly too. `push` also returns the new *length*, not the array. Do this instead: `setUsers(prev => [...prev, x])`.

**Q2. `map` vs `forEach`?**
`map` returns a **new array** of the same length, built from what your callback returns. It is pure and chainable, and JSX lists are built with it. `forEach` returns `undefined` and is only for side effects (logging, pushing into something else). If you need a result, use `map`, `filter` or `reduce`.

**Self-check (try before reading the code):**
- What do `closuresWithVar()` and `closuresWithLet()` return, and why are they different?
- Why does `updateUser(...)` keep the *same* reference for the users that didn't change?
- When would you choose `Promise.allSettled` over `Promise.all`?
- In C#, why is `0 || 1` not a problem?

Write anything you got wrong in `NOTES.md`.
