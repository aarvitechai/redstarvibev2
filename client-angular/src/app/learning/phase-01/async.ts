// Phase 1.4 (TypeScript): Promise<T>, async/await, and the Angular extra: Observable<T>
import { Observable, defer, firstValueFrom, from, map, of, throwError, delay as rxDelay } from 'rxjs';

export interface User {
  id: number;
  name: string;
}

const fakeDb: Record<number, User> = { 1: { id: 1, name: 'Asha' }, 2: { id: 2, name: 'Ravi' } };

export function fetchUser(id: number, ms = 10): Promise<User> {
  return new Promise<User>((resolve, reject) => {
    setTimeout(() => {
      const user = fakeDb[id];
      if (user) resolve(user);
      else reject(new Error(`User ${id} not found`));
    }, ms);
  });
}

export async function getUserName(id: number): Promise<string> {
  try {
    return (await fetchUser(id)).name;
  } catch {
    return 'Guest';
  }
}

export const loadParallel = (ids: number[]): Promise<User[]> => Promise.all(ids.map((id) => fetchUser(id)));

export async function loadWhatYouCan(ids: number[]): Promise<User[]> {
  const results = await Promise.allSettled(ids.map((id) => fetchUser(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<User> => r.status === 'fulfilled') // a type guard
    .map((r) => r.value);
}

// ---------- Observable vs Promise ----------
// Angular's HttpClient returns an Observable. Unlike a Promise, it is:
//  - lazy: nothing runs until someone subscribes
//  - multi-value: it can emit many values over time
//  - cancellable: unsubscribe (Angular does this for you with the async pipe / takeUntilDestroyed)
export function fetchUser$(id: number): Observable<User> {
  const user = fakeDb[id];
  return user ? of(user).pipe(rxDelay(10)) : throwError(() => new Error(`User ${id} not found`));
}

export const userName$ = (id: number): Observable<string> => fetchUser$(id).pipe(map((u) => u.name));

// Bridges between the two worlds
export const observableToPromise = (id: number): Promise<string> => firstValueFrom(userName$(id));
// from(promise) is EAGER: the request already started when fetchUser() was called.
export const promiseToObservableEager = (id: number): Observable<User> => from(fetchUser(id));
// defer(() => promise) is LAZY: fetchUser() runs only when someone subscribes (and again per subscriber).
export const promiseToObservable = (id: number, onStart?: () => void): Observable<User> =>
  defer(() => {
    onStart?.();
    return fetchUser(id);
  });
