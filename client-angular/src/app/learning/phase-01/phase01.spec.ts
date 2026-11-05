import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as basics from './basics';
import * as arr from './arrays';
import * as values from './values';
import * as asyncDemo from './async';
import * as users from './users';

describe('Phase 1 (TS) basics', () => {
  it('let, arrows, destructuring, spread/rest', () => {
    expect(basics.closuresWithLet()).toEqual([0, 1, 2]);
    expect(basics.add(2, 3)).toBe(5);
    expect(basics.describeUser({ id: 7, name: 'Asha', roles: ['admin'] })).toBe('7:Asha from unknown [admin]');
    expect(basics.firstAndRest([1, 2, 3])).toEqual({ first: 1, rest: [2, 3] });
    expect(basics.mergeSettings({ theme: 'light', pageSize: 10 }, { theme: 'dark' })).toEqual({
      theme: 'dark',
      pageSize: 10,
    });
    expect(basics.sum(1, 2, 3)).toBe(6);
  });

  it('union types', () => {
    expect(basics.canRate('Completed')).toBe(true);
    expect(basics.canRate('Pending')).toBe(false);
  });
});

describe('Phase 1 (TS) arrays', () => {
  const p = arr.products;

  it('map/filter/find/reduce/some/every', () => {
    expect(arr.getNames(p)).toEqual(['Burger', 'Fries', 'Salad', 'Cola']);
    expect(arr.getInStock(p)).toHaveLength(3);
    expect(arr.findById(p, 99)).toBeUndefined();
    expect(arr.totalPrice(p)).toBeCloseTo(19.75);
    expect(arr.groupByCategory(p).Main).toHaveLength(2);
    expect(arr.hasOutOfStock(p)).toBe(true);
    expect(arr.allPriced(p)).toBe(true);
  });

  it('sorting a copy leaves the source untouched', () => {
    const sorted = arr.sortByPrice(p);
    expect(sorted.map((x) => x.id)).toEqual([4, 2, 3, 1]);
    expect(p.map((x) => x.id)).toEqual([1, 2, 3, 4]);
    expect(arr.cheapMainsInStock(p)).toEqual(['Burger']);
  });
});

describe('Phase 1 (TS) values', () => {
  it('falsy, ?? vs ||, optional chaining', () => {
    values.FALSY_VALUES.forEach((v) => expect(Boolean(v)).toBe(false));
    expect(values.withOr(0)).toBe(1);
    expect(values.withNullish(0)).toBe(0);
    expect(values.getCity(null)).toBe('unknown');
  });

  it('signals only notify on a NEW reference', () => {
    const state = signal<values.Counter>({ count: 0 });
    const before = state();
    state.update(values.increment);
    expect(state()).not.toBe(before);
    expect(state().count).toBe(1);
  });

  it('nested update copies each level', () => {
    const u: values.Person = { name: 'A', address: { city: 'Pune' } };
    const next = values.updateCity(u, 'Delhi');
    expect(u.address.city).toBe('Pune');
    expect(next.address.city).toBe('Delhi');
  });
});

describe('Phase 1 (TS) async', () => {
  it('async/await and Promise.all / allSettled', async () => {
    expect(await asyncDemo.getUserName(1)).toBe('Asha');
    expect(await asyncDemo.getUserName(99)).toBe('Guest');
    expect(await asyncDemo.loadParallel([1, 2])).toHaveLength(2);
    await expect(asyncDemo.loadParallel([1, 99])).rejects.toThrow('User 99 not found');
    expect(await asyncDemo.loadWhatYouCan([1, 99, 2])).toHaveLength(2);
  });

  it('Observables are lazy and convertible', async () => {
    let started = 0;
    const obs = asyncDemo.promiseToObservable(1, () => started++);
    expect(started).toBe(0); // lazy: no work until someone subscribes
    expect(await firstValueFrom(obs)).toEqual({ id: 1, name: 'Asha' });
    expect(started).toBe(1);
    expect(await firstValueFrom(asyncDemo.promiseToObservableEager(2))).toEqual({ id: 2, name: 'Ravi' });
    expect(await asyncDemo.observableToPromise(2)).toBe('Ravi');
    await expect(firstValueFrom(asyncDemo.fetchUser$(99))).rejects.toThrow('User 99 not found');
  });
});

describe('Phase 1 PRACTICE (TS): immutable users', () => {
  const list = users.initialUsers;

  it('add / update / remove / toggle return new arrays', () => {
    const added = users.addUser(list, { name: 'Meera', email: 'm@example.com' });
    expect(added).not.toBe(list);
    expect(added[2]).toEqual({ id: 3, name: 'Meera', email: 'm@example.com', active: true });

    const updated = users.updateUser(list, 1, { name: 'Asha K' });
    expect(updated[0].name).toBe('Asha K');
    expect(updated[1]).toBe(list[1]); // the untouched item keeps its reference

    expect(users.removeUser(list, 1).map((u) => u.id)).toEqual([2]);
    expect(users.countActive(users.toggleActive(list, 2))).toBe(2);
    expect(list).toHaveLength(2); // the source never changes
  });

  it('works with signal.update (how Angular components will use it)', () => {
    const state = signal(list);
    state.update((u) => users.toggleActive(u, 1));
    expect(state()[0].active).toBe(false);
  });
});
