// Phase 1.3 (TypeScript): truthy/falsy, nullish, references

export const FALSY_VALUES: readonly unknown[] = [false, 0, -0, 0n, '', null, undefined, NaN];

// The same && trap exists in Angular templates: @if (count && ...) hides the block when count is 0.
export const withOr = (qty: number | null | undefined): number => qty || 1; // 0 -> 1
export const withNullish = (qty: number | null | undefined): number => qty ?? 1; // 0 stays 0

interface WithAddress {
  address?: { city?: string };
}
export const getCity = (user: WithAddress | null | undefined): string =>
  user?.address?.city ?? 'unknown';

// References: Angular's OnPush change detection and signals also compare by reference.
// signal.set(sameMutatedObject) does NOT notify anyone. You must give it a new object.
export interface Counter {
  readonly count: number;
}
export const increment = (state: Counter): Counter => ({ ...state, count: state.count + 1 });

export interface Person {
  name: string;
  address: { city: string };
}
export const updateCity = (user: Person, city: string): Person => ({
  ...user,
  address: { ...user.address, city },
});
