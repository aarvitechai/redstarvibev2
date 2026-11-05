// Phase 1.4: promises and async/await

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fakeDb = { 1: { id: 1, name: 'Asha' }, 2: { id: 2, name: 'Ravi' } };

// A fake API call: resolves after a delay, or rejects for an unknown id
export function fetchUser(id, ms = 10) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = fakeDb[id];
      if (user) resolve(user);
      else reject(new Error(`User ${id} not found`));
    }, ms);
  });
}

// The same call with .then/.catch chaining
export const getUserNameThen = (id) =>
  fetchUser(id)
    .then((u) => u.name)
    .catch(() => 'Guest');

// The same call with async/await: reads top to bottom, and errors go to try/catch
export async function getUserName(id) {
  try {
    const user = await fetchUser(id);
    return user.name;
  } catch {
    return 'Guest';
  }
}

// Sequential: each await waits for the previous one -> total time = sum of all delays
export async function loadSequential(ids) {
  const users = [];
  for (const id of ids) users.push(await fetchUser(id));
  return users;
}

// Parallel: start them all, then await together -> total time = the slowest one.
// Promise.all rejects as soon as ONE call fails.
export const loadParallel = (ids) => Promise.all(ids.map((id) => fetchUser(id)));

// allSettled never rejects: each result is { status: 'fulfilled', value } or { status: 'rejected', reason }
export async function loadWhatYouCan(ids) {
  const results = await Promise.allSettled(ids.map((id) => fetchUser(id)));
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}
