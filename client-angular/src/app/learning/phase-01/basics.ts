// Phase 1.1 (TypeScript): let/const, arrows, destructuring, spread/rest, modules, plus types

// ---------- let / const ----------
export function closuresWithLet(): number[] {
  const fns: Array<() => number> = [];
  for (let i = 0; i < 3; i++) fns.push(() => i); // a new i per iteration
  return fns.map((fn) => fn()); // [0, 1, 2]
}

// ---------- arrow functions with types ----------
export const add = (a: number, b: number): number => a + b;

// ---------- interfaces + destructuring ----------
export interface Address {
  city?: string;
}
export interface UserInfo {
  id: number;
  name: string;
  address?: Address; // optional property
  roles?: readonly string[];
}

export function describeUser({ id: userId, name, address, roles = [] }: UserInfo): string {
  return `${userId}:${name} from ${address?.city ?? 'unknown'} [${roles.join(',')}]`;
}

// Tuples + array destructuring (Angular signals use this kind of pair too)
export function firstAndRest<T>([first, ...rest]: readonly T[]): { first: T | undefined; rest: T[] } {
  return { first, rest };
}

// ---------- spread / rest with generics ----------
// Partial<T> = every property optional. This is the type of an "overrides" object.
export const mergeSettings = <T extends object>(defaults: T, overrides: Partial<T>): T => ({
  ...defaults,
  ...overrides,
});
export const sum = (...nums: number[]): number => nums.reduce((t, n) => t + n, 0);

// ---------- union types + narrowing (TS-only, used everywhere in Angular) ----------
export type OrderStatus = 'Pending' | 'Confirmed' | 'Ready' | 'Completed' | 'Cancelled';
export const canRate = (status: OrderStatus): boolean => status === 'Completed';
// canRate('Done') is a COMPILE error. The type system catches typos before runtime.

// ---------- modules ----------
// Angular style: named exports only (default exports are discouraged in Angular code).
export const greet = (name: string): string => `Hello, ${name}`;
