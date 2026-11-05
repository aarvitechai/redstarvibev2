# Phase 2: React Fundamentals (Project 1, part 1)

**Goal:** a student card list inside a Header / Footer / Layout, built from small components that receive data through props.

## What was built

| Piece | React | Angular | Backend |
| --- | --- | --- | --- |
| Data contract | `src/data/students.js` | `features/students/student.model.ts`, `students.data.ts` | `Models/Dto/StudentDto.cs` |
| Layout shell | `components/layout/Layout.jsx` (`children`) | `core/layout/layout.ts` (`<ng-content>`) | — |
| Header / Footer | `Header.jsx`, `Footer.jsx` | `header.ts`, `footer.ts` | — |
| Generic wrapper | `components/students/Card.jsx` | `features/students/card.ts` | — |
| Card / List | `StudentCard.jsx`, `StudentList.jsx` | `student-card.ts`, `student-list.ts` | — |
| Page | `pages/StudentsPage.jsx` | `students-page.ts` | `GET /api/students`, `GET /api/students/{id}` |
| Styling | CSS Modules (`*.module.css`) | component styles (scoped by Angular) | — |
| Envelope | — | — | `Models/ApiResponse.cs` |
| Tests | `src/tests/*.test.jsx` (RTL) | `*.spec.ts` (TestBed) | `StudentsEndpointTests.cs` |

The clients still use **static data** with the same shape as the API's `StudentDto`. They start fetching from the API in Phase 4 (`useEffect`) and Phase 6 (Axios); Angular will use HttpClient.

## Concept map

| Concept | React | Angular |
| --- | --- | --- |
| Component | a function that returns JSX | a class with `@Component` |
| Input data | props: `function Card({ student })` | `student = input.required<Student>()` |
| Default value | `{ appName = 'RedStarVibe' }` | `input('RedStarVibe')` |
| Nested content | `{children}` | `<ng-content />` |
| List | `.map(s => <X key={s.id} />)` | `@for (s of list; track s.id)` |
| Condition | `a ? <X/> : <Y/>` / early `return` | `@if / @else` |
| Toggle a class | `className={on ? styles.a : styles.b}` | `[class.active]="on"` |
| Derived value | compute it in the render | `computed(() => ...)` |
| Scoped CSS | CSS Modules | `styleUrl` (emulated encapsulation) |
| Dev checks | `<StrictMode>` | dev mode, and `input.required` is checked at compile time |

## JSX rules (from the code)
1. Return **one** root element (or a fragment `<>...</>`).
2. Use `className`, not `class`; use `htmlFor`, not `for`; attributes are camelCase.
3. `{ }` holds **expressions** only: a ternary works, an `if` statement doesn't.
4. Close every tag: `<Avatar />`.
5. Component names start with a **capital letter** (`<Card>` is a component; `<card>` would be an HTML tag).

## Default vs named exports
- Components use **default** exports: `import Layout from './Layout'`.
- Data and helpers use **named** exports: `import { students } from '../data/students'`.
- Keep helpers out of component files, or Fast Refresh breaks. That's why `getInitials` lives in `utility/format.js`. The linter caught it.

## Backend notes
- `ApiResponse<T>` gives `{ success, data, errors }` **plus** the real status code (200 or 404). Clients branch on the status and read `data`.
- The controller depends on `IStudentService`, not a concrete class. Phase 11 swaps in EF Core without changing the controller.
- The service is a **singleton** because it holds read-only data and no per-request state. DI lifetimes are covered properly in Phase 11.

## Run it
```bash
cd server && dotnet run --project Server.Api --launch-profile http   # http://localhost:5240/scalar
cd client-react && npm run dev                                       # http://localhost:5173
cd client-angular && npm start                                       # http://localhost:4200
```

## Checkpoint: answer these out loud before Phase 3

**Q1. Props vs state?**
**Props** are inputs passed in by the parent. They are read-only for the child, which must never change them. **State** is data a component owns and changes over time (with `useState`); changing it re-renders the component. The usual pattern: the parent owns the state and passes it down as props. In this phase every component only had props, because nothing changes yet. State arrives in Phase 3. In Angular, `input()` is the equivalent of props, and `signal()` is the equivalent of state.

**Q2. What does StrictMode do?**
It's a **development-only** helper with no effect on the production build. It renders components twice and runs effects as mount, then unmount, then mount again. This exposes impure render logic and effects that are missing their cleanup. The linter flagged one such risk in this phase: calling `new Date()` inside render.

**Self-check:**
- Why do `key={student.id}` and `track s.id` matter, and what goes wrong with the array index? (Covered in depth in Phase 3.)
- How does `<Layout>` render a page it knows nothing about?
- Why is `Object.freeze` used on the test data?
- Why does a missing student return **404 plus the envelope**, instead of 200 with `success: false`?
