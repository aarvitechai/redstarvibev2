// Phase 1.1: let/const, arrow functions, destructuring, spread/rest, modules

// ---------- let / const ----------
// const = the binding can't be reassigned (an object's contents can still change).
// let   = block-scoped and reassignable. Never use var: it is function-scoped and hoisted.
export function closuresWithLet() {
  const fns = [];
  for (let i = 0; i < 3; i++) fns.push(() => i); // each iteration gets a NEW i
  return fns.map((fn) => fn()); // [0, 1, 2]
}

export function closuresWithVar() {
  const fns = [];
  for (var i = 0; i < 3; i++) fns.push(() => i); // ONE shared i
  return fns.map((fn) => fn()); // [3, 3, 3]  <- classic bug
}

// ---------- arrow functions ----------
export const add = (a, b) => a + b; // implicit return
export const toUser = (name) => ({ name, active: true }); // wrap object literals in ()

// Arrows don't have their own `this`; they use the enclosing one (lexical this).
export function createTimerOwner() {
  return {
    ticks: 0,
    tick() {
      [1, 2, 3].forEach(() => this.ticks++); // `this` is the owner object
      return this.ticks;
    },
  };
}

// ---------- destructuring ----------
// Object destructuring with nested values, defaults and renaming. React props use this all the time.
export function describeUser({ name, address: { city } = {}, roles = [], id: userId }) {
  return `${userId}:${name} from ${city ?? 'unknown'} [${roles.join(',')}]`;
}

// Array destructuring is how useState works: const [value, setValue] = useState()
export function firstAndRest([first, ...rest]) {
  return { first, rest };
}

// ---------- spread / rest ----------
// spread = expand into a NEW array/object (a shallow copy). Later keys win.
export const mergeSettings = (defaults, overrides) => ({ ...defaults, ...overrides });
// rest = gather the remaining arguments into a real array
export const sum = (...nums) => nums.reduce((total, n) => total + n, 0);

// ---------- modules ----------
// Named exports (above) are imported as { add }. A file has at most ONE default export.
export default function greet(name) {
  return `Hello, ${name}`;
}
