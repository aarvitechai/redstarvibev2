// Phase 1.2: array methods. None of these change the original array, except sort/reverse/splice.

export const products = [
  { id: 1, name: 'Burger', price: 8.5, category: 'Main', inStock: true },
  { id: 2, name: 'Fries', price: 3.0, category: 'Side', inStock: true },
  { id: 3, name: 'Salad', price: 6.25, category: 'Main', inStock: false },
  { id: 4, name: 'Cola', price: 2.0, category: 'Drink', inStock: true },
];

// map: transform each item -> a new array of the SAME length. In React it renders lists.
export const getNames = (items) => items.map((p) => p.name);

// filter: keep the items that match -> a new array of the same or shorter length
export const getInStock = (items) => items.filter((p) => p.inStock);

// find: the FIRST match, or undefined (never null)
export const findById = (items, id) => items.find((p) => p.id === id);

// reduce: fold the items into ONE value (a total, an object, a map). Always pass the initial value.
export const totalPrice = (items) => items.reduce((total, p) => total + p.price, 0);
export const groupByCategory = (items) =>
  items.reduce((groups, p) => {
    (groups[p.category] ??= []).push(p); // OK here: `groups` is our own new accumulator
    return groups;
  }, {});

// some: is there at least one? every: do all match?
export const hasOutOfStock = (items) => items.some((p) => !p.inStock);
export const allPriced = (items) => items.every((p) => p.price > 0);

// sort MUTATES the array in place. In React that changes props/state, which is a bug.
export const sortByPriceWrong = (items) => items.sort((a, b) => a.price - b.price);
// Fix: copy first (or use the ES2023 toSorted, which returns a new array)
export const sortByPrice = (items) => [...items].sort((a, b) => a.price - b.price);
export const sortByPriceModern = (items) => items.toSorted((a, b) => a.price - b.price);

// map vs forEach: map RETURNS a new array; forEach returns undefined (only for side effects).
export const forEachReturns = (items) => items.forEach((p) => p.name); // always undefined

// Chaining: names of in-stock Main dishes, cheapest first
export const cheapMainsInStock = (items) =>
  items
    .filter((p) => p.inStock && p.category === 'Main')
    .toSorted((a, b) => a.price - b.price)
    .map((p) => p.name);
