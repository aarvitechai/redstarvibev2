# Phase 9: Redux Toolkit (Project 4: Redux counter and cart)

**Goal:** one store for app-wide client state (**auth, cart, theme**), as in the plan's state-ownership table. Slices with Immer, selectors, thunks, reset on logout, and a cart that survives a reload. The **server** prices the cart.

## What was built

| Piece | React (Redux Toolkit) | Angular (signal + reducer) | Backend |
| --- | --- | --- | --- |
| Store | `store/index.js`: `makeStore()`, `configureStore` | `features/cart/cart-store.ts` (`providedIn: 'root'`) | — |
| Counter | `store/counterSlice.js` + `learning/phase-09/ReduxCounter.jsx` | (signals since Phase 3) | — |
| Cart | `store/cartSlice.js` | `features/cart/cart.state.ts` (pure reducer) | `POST /api/cart/price` |
| Theme | `store/themeSlice.js` + `ThemeSync` | `ThemeService` (Phase 4) | — |
| Auth | `store/authSlice.js` (`loginUser` thunk) + `SessionWatcher` | `Session` (Phase 8) | demo auth |
| Hook / API | `hooks/useAuth.js` (the same API as Phase 8) | `inject(CartStore)` | — |
| Cart UI | `pages/CartPage.jsx`, `AddToCartButton`, header badge | `cart-page.ts`, `add-to-cart-button.ts`, header badge | — |
| Persistence | `persistCart(store)` / `loadCart()` | an `effect()` in `CartStore` | — |

**Migrations:** theme (Phase 4 Context) and auth (Phase 8 Context) moved into Redux. Because components used `useAuth()` and not the Context directly, **no page changed**, and all the Phase 8 auth tests passed unchanged.

## Redux in one minute
```
UI event ──dispatch(action)──▶ STORE ──(state, action)──▶ REDUCER ──▶ new state
   ▲                                                                       │
   └──────────── useSelector(selector) re-renders what changed ◀───────────┘
```
- **Action:** a plain object describing what happened: `{ type: 'cart/itemAdded', payload: product }`.
- **Dispatch:** sends it: `dispatch(itemAdded(product))`.
- **Reducer:** a pure `(state, action) => newState`. No API calls, no `Date.now()`, no storage.
- **Selector:** reads a piece of state: `useSelector(selectCartCount)`.

## How "mutation" works in slices (Immer)
```js
itemAdded: (state, { payload }) => { state.items.push(...) }   // looks like a mutation
```
Inside `createSlice`, `state` is an Immer **draft**. Immer records the changes and builds a **new immutable state**, sharing every unchanged part. The tests reduce **deep-frozen** state, so a real mutation would throw. Rules: either mutate the draft **or** return a new value, never both. This works **only** inside slices (`createSlice` / `createReducer`); everywhere else, mutating state is still a bug. Angular's reducer has no Immer, so it uses spread, `map` and `filter` by hand.

## Selectors and memoization
`createSelector([selectCartItems], items => total)` recalculates only when `items` is a **new reference**. A test checks that an unrelated `counter/incremented` doesn't recompute the subtotal. Angular's `computed()` gives the same thing.

## Thunks (`createAsyncThunk`)
`loginUser` and `priceCart` dispatch `pending → fulfilled | rejected` automatically, and `extraReducers` handles each step. Side effects (HTTP, `saveSession`) live in the thunk. `rejectWithValue(message)` keeps state **serialisable** (no `Error` objects in the store).

## Reset on logout
`cartSlice.extraReducers.addCase(loggedOut, () => initialState)`: one slice reacts to another slice's action. The next person on a shared computer never inherits the cart. Angular does the same by subscribing to `Session.loggedOut$`.

## Never trust the client's total
The cart keeps prices **for display**. `POST /api/cart/price` receives **only `{ productId, quantity }`**, looks the prices up in the catalogue, merges duplicate lines, rejects quantities outside 1–20, and reports unavailable products. A backend test sends `price: 0.01` and gets the real price back. Phase 13's checkout uses the same idea (snapshot pricing).

**Money:** the backend uses `decimal`. The clients total in **paise (integers)**, because `0.1 * 3` is `0.30000000000000004` in JavaScript. A test covers this.

## State ownership (where should this live?)
| Need | Tool | Example |
| --- | --- | --- |
| Local UI | `useState` / `signal` | the counter step, form drafts |
| App-wide client state | **Redux slice** / root service | auth, cart, theme |
| Server data | RTK Query (**Phase 10**) | products, contacts |
| URL state | search params | product filters (Phase 7) |

## Checkpoint: answer these out loud before Phase 10

**Q1. How does "mutation" work in slices?**
Redux needs a **new** state object for every change, because components compare references. Immer gives the reducer a draft proxy. You write `state.items.push(x)`, Immer records it, and then it produces a new frozen state with structural sharing. The original is never touched. It's safe only inside `createSlice` / `createReducer`.

**Q2. Action, reducer, dispatch and selector in one minute?**
The UI **dispatches** an **action** (a plain object saying *what happened*). The store passes the current state and the action to the **reducer**, a pure function that returns the next state. Components read state with **selectors** through `useSelector`, and re-render only when the selected value changes. Async work goes in **thunks**, which dispatch actions as they progress.

**Self-check:**
- Why must reducers be pure, and where did the localStorage write go instead?
- Why does `AddToCartButton` sit outside the product card's `<Link>`?
- Why does changing a quantity throw away the server quote?
- What does `.unwrap()` do in `useAuth().login`?
- Why is `makeStore()` a factory and not a single exported store?
