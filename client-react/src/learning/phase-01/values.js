// Phase 1.3: truthy/falsy and reference types

// ---------- truthy / falsy ----------
// There are only 8 falsy values. Everything else (including [] and {}) is truthy.
export const FALSY_VALUES = [false, 0, -0, 0n, '', null, undefined, NaN];

// The JSX trap: {count && <Badge/>} renders "0" when count is 0,
// because && returns the left side when it is falsy, and React renders the number 0.
export const andOperator = (count, value) => count && value; // returns 0 when count is 0
export const safeAnd = (count, value) => (count > 0 ? value : null); // the fix: use a real boolean

// || vs ??: || replaces ANY falsy value; ?? replaces only null/undefined
export const withOr = (qty) => qty || 1; // 0 -> 1 (usually a bug)
export const withNullish = (qty) => qty ?? 1; // 0 stays 0

// Optional chaining: stops at the first null/undefined instead of throwing
export const getCity = (user) => user?.address?.city ?? 'unknown';

// ---------- reference types ----------
// Objects and arrays are compared by REFERENCE, not by content.
// oxlint-disable-next-line no-constant-binary-expression -- intentional demo
export const sameContentDifferentRef = () => ({ a: 1 }) === ({ a: 1 }); // false

// React decides "did state change?" with Object.is(old, new), i.e. by reference.
// So when you mutate the same object, React thinks nothing changed and may skip the re-render.
export function mutateKeepsReference(state) {
  state.count++;
  return state; // the same reference -> React sees "no change"
}
export const copyMakesNewReference = (state) => ({ ...state, count: state.count + 1 });

// Spread is SHALLOW: nested objects are still shared between the copy and the original.
export function shallowCopyPitfall(user) {
  const copy = { ...user };
  copy.address.city = 'Changed'; // also changes user.address.city!
  return copy;
}
// Fix: copy each level you change (preferred for state), or use structuredClone for a full deep copy.
export const updateCity = (user, city) => ({ ...user, address: { ...user.address, city } });
export const deepClone = (value) => structuredClone(value);
