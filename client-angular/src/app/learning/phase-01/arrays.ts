// Phase 1.2 (TypeScript): array methods with types.
// `readonly Product[]` makes the COMPILER reject push/sort/splice on the input.

export interface Product {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly category: 'Main' | 'Side' | 'Drink';
  readonly inStock: boolean;
}

export const products: readonly Product[] = [
  { id: 1, name: 'Burger', price: 8.5, category: 'Main', inStock: true },
  { id: 2, name: 'Fries', price: 3.0, category: 'Side', inStock: true },
  { id: 3, name: 'Salad', price: 6.25, category: 'Main', inStock: false },
  { id: 4, name: 'Cola', price: 2.0, category: 'Drink', inStock: true },
];

export const getNames = (items: readonly Product[]): string[] => items.map((p) => p.name);
export const getInStock = (items: readonly Product[]): Product[] => items.filter((p) => p.inStock);
// find returns `Product | undefined`. TS forces you to handle the "not found" case.
export const findById = (items: readonly Product[], id: number): Product | undefined =>
  items.find((p) => p.id === id);

export const totalPrice = (items: readonly Product[]): number =>
  items.reduce((total, p) => total + p.price, 0);

export const groupByCategory = (items: readonly Product[]): Partial<Record<Product['category'], Product[]>> =>
  items.reduce<Partial<Record<Product['category'], Product[]>>>((groups, p) => {
    (groups[p.category] ??= []).push(p);
    return groups;
  }, {});

export const hasOutOfStock = (items: readonly Product[]): boolean => items.some((p) => !p.inStock);
export const allPriced = (items: readonly Product[]): boolean => items.every((p) => p.price > 0);

// items.sort(...) would NOT compile here, because the input is readonly. Copy first:
export const sortByPrice = (items: readonly Product[]): Product[] =>
  [...items].sort((a, b) => a.price - b.price);

export const cheapMainsInStock = (items: readonly Product[]): string[] =>
  items
    .filter((p) => p.inStock && p.category === 'Main')
    .sort((a, b) => a.price - b.price) // OK: filter already returned a new array
    .map((p) => p.name);
