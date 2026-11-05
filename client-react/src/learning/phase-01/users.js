// Phase 1 PRACTICE: immutable add / update / remove / toggle on a users array.
// These are exactly the updates you will later write in useState, useReducer and Redux.
// Rule: never change the input. Always return a NEW array (and new objects for the items you change).

export const initialUsers = [
  { id: 1, name: 'Asha', email: 'asha@example.com', active: true },
  { id: 2, name: 'Ravi', email: 'ravi@example.com', active: false },
];

// Simple id generator for the practice. Real ids come from the server.
export const nextId = (users) => users.reduce((max, u) => Math.max(max, u.id), 0) + 1;

// ADD: spread the old items into a new array
export const addUser = (users, user) => [...users, { id: nextId(users), active: true, ...user }];

// UPDATE: map, and replace only the matching item with a new object
export const updateUser = (users, id, changes) =>
  users.map((u) => (u.id === id ? { ...u, ...changes, id } : u)); // id can't be overwritten

// REMOVE: filter it out
export const removeUser = (users, id) => users.filter((u) => u.id !== id);

// TOGGLE: a special case of update
export const toggleActive = (users, id) =>
  users.map((u) => (u.id === id ? { ...u, active: !u.active } : u));

// Derived data: compute it from state, don't store it separately
export const countActive = (users) => users.filter((u) => u.active).length;

// WRONG on purpose: push mutates the original array and returns the new LENGTH, not the array
export function addUserWrong(users, user) {
  users.push(user);
  return users;
}
