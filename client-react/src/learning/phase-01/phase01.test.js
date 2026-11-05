import { describe, expect, it } from 'vitest';
import greet, * as basics from './basics';
import * as arr from './arrays';
import * as values from './values';
import * as asyncDemo from './async';
import * as users from './users';

describe('1.1 basics', () => {
  it('let creates a new binding per loop iteration; var shares one', () => {
    expect(basics.closuresWithLet()).toEqual([0, 1, 2]);
    expect(basics.closuresWithVar()).toEqual([3, 3, 3]);
  });

  it('arrow functions: implicit return and lexical this', () => {
    expect(basics.add(2, 3)).toBe(5);
    expect(basics.toUser('A')).toEqual({ name: 'A', active: true });
    expect(basics.createTimerOwner().tick()).toBe(3);
  });

  it('destructuring with defaults and renaming', () => {
    expect(basics.describeUser({ id: 7, name: 'Asha', roles: ['admin'] })).toBe(
      '7:Asha from unknown [admin]',
    );
    expect(basics.firstAndRest([1, 2, 3])).toEqual({ first: 1, rest: [2, 3] });
  });

  it('spread / rest / default export', () => {
    const defaults = { theme: 'light', pageSize: 10 };
    const merged = basics.mergeSettings(defaults, { theme: 'dark' });
    expect(merged).toEqual({ theme: 'dark', pageSize: 10 });
    expect(merged).not.toBe(defaults);
    expect(basics.sum(1, 2, 3)).toBe(6);
    expect(greet('Ravi')).toBe('Hello, Ravi');
  });
});

describe('1.2 arrays', () => {
  const p = arr.products;

  it('map / filter / find', () => {
    expect(arr.getNames(p)).toEqual(['Burger', 'Fries', 'Salad', 'Cola']);
    expect(arr.getInStock(p)).toHaveLength(3);
    expect(arr.findById(p, 2).name).toBe('Fries');
    expect(arr.findById(p, 99)).toBeUndefined();
  });

  it('reduce / some / every', () => {
    expect(arr.totalPrice(p)).toBeCloseTo(19.75);
    expect(Object.keys(arr.groupByCategory(p))).toEqual(['Main', 'Side', 'Drink']);
    expect(arr.hasOutOfStock(p)).toBe(true);
    expect(arr.allPriced(p)).toBe(true);
  });

  it('sort mutates the original; copy-then-sort does not', () => {
    const original = [...p];
    const before = original.map((x) => x.id);
    arr.sortByPrice(original);
    arr.sortByPriceModern(original);
    expect(original.map((x) => x.id)).toEqual(before); // untouched

    arr.sortByPriceWrong(original);
    expect(original.map((x) => x.id)).not.toEqual(before); // mutated!
  });

  it('forEach returns undefined; chaining works', () => {
    expect(arr.forEachReturns(p)).toBeUndefined();
    expect(arr.cheapMainsInStock(p)).toEqual(['Burger']);
  });
});

describe('1.3 truthy/falsy and references', () => {
  it('falsy values and the && trap', () => {
    values.FALSY_VALUES.forEach((v) => expect(Boolean(v)).toBe(false));
    expect(Boolean([])).toBe(true);
    expect(values.andOperator(0, 'badge')).toBe(0); // would render "0" in JSX
    expect(values.safeAnd(0, 'badge')).toBeNull();
  });

  it('|| vs ?? and optional chaining', () => {
    expect(values.withOr(0)).toBe(1);
    expect(values.withNullish(0)).toBe(0);
    expect(values.getCity({})).toBe('unknown');
    expect(values.getCity(null)).toBe('unknown');
  });

  it('references: mutate keeps the ref, spread makes a new one', () => {
    expect(values.sameContentDifferentRef()).toBe(false);
    const state = { count: 0 };
    expect(values.mutateKeepsReference(state)).toBe(state);
    expect(values.copyMakesNewReference(state)).not.toBe(state);
  });

  it('spread is shallow', () => {
    const user = { name: 'A', address: { city: 'Pune' } };
    values.shallowCopyPitfall(user);
    expect(user.address.city).toBe('Changed'); // the original was affected

    const safe = { name: 'A', address: { city: 'Pune' } };
    const updated = values.updateCity(safe, 'Delhi');
    expect(safe.address.city).toBe('Pune');
    expect(updated.address.city).toBe('Delhi');
    expect(values.deepClone(safe).address).not.toBe(safe.address);
  });
});

describe('1.4 async', () => {
  it('then/catch and async/await give the same result', async () => {
    expect(await asyncDemo.getUserNameThen(1)).toBe('Asha');
    expect(await asyncDemo.getUserName(1)).toBe('Asha');
    expect(await asyncDemo.getUserName(99)).toBe('Guest');
  });

  it('parallel vs sequential, all vs allSettled', async () => {
    expect(await asyncDemo.loadSequential([1, 2])).toHaveLength(2);
    expect(await asyncDemo.loadParallel([1, 2])).toHaveLength(2);
    await expect(asyncDemo.loadParallel([1, 99])).rejects.toThrow('User 99 not found');
    expect(await asyncDemo.loadWhatYouCan([1, 99, 2])).toHaveLength(2);
  });
});

describe('PRACTICE: immutable users', () => {
  const frozen = () => Object.freeze(users.initialUsers.map((u) => Object.freeze({ ...u })));

  it('add returns a new array and never mutates', () => {
    const list = frozen(); // frozen: any mutation would throw
    const next = users.addUser(list, { name: 'Meera', email: 'm@example.com' });
    expect(next).not.toBe(list);
    expect(next).toHaveLength(3);
    expect(next[2]).toMatchObject({ id: 3, name: 'Meera', active: true });
    expect(list).toHaveLength(2);
  });

  it('update replaces only the matching object', () => {
    const list = frozen();
    const next = users.updateUser(list, 1, { name: 'Asha K', id: 999 });
    expect(next[0]).toMatchObject({ id: 1, name: 'Asha K' });
    expect(next[0]).not.toBe(list[0]); // the changed item is a new object
    expect(next[1]).toBe(list[1]); // the unchanged item keeps its reference
  });

  it('remove and toggle', () => {
    const list = frozen();
    expect(users.removeUser(list, 1).map((u) => u.id)).toEqual([2]);
    expect(users.toggleActive(list, 2)[1].active).toBe(true);
    expect(users.countActive(users.toggleActive(list, 2))).toBe(2);
  });

  it('push is wrong: it mutates the input (a frozen array throws)', () => {
    expect(() => users.addUserWrong(frozen(), { id: 3 })).toThrow(TypeError);
  });
});
