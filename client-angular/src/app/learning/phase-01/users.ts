// Phase 1 PRACTICE (TypeScript): immutable add / update / remove / toggle.
// These are the exact functions you will pass to signal.update(...) in Angular.
// The `readonly` modifiers make mutation a compile error, not just a code-review comment.

export interface User {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly active: boolean;
}

export type NewUser = Omit<User, 'id' | 'active'> & Partial<Pick<User, 'active'>>;
export type UserChanges = Partial<Omit<User, 'id'>>; // the id can't be changed: enforced by the type

export const initialUsers: readonly User[] = [
  { id: 1, name: 'Asha', email: 'asha@example.com', active: true },
  { id: 2, name: 'Ravi', email: 'ravi@example.com', active: false },
];

export const nextId = (users: readonly User[]): number =>
  users.reduce((max, u) => Math.max(max, u.id), 0) + 1;

export const addUser = (users: readonly User[], user: NewUser): readonly User[] => [
  ...users,
  { active: true, ...user, id: nextId(users) },
];

export const updateUser = (users: readonly User[], id: number, changes: UserChanges): readonly User[] =>
  users.map((u) => (u.id === id ? { ...u, ...changes } : u));

export const removeUser = (users: readonly User[], id: number): readonly User[] =>
  users.filter((u) => u.id !== id);

export const toggleActive = (users: readonly User[], id: number): readonly User[] =>
  users.map((u) => (u.id === id ? { ...u, active: !u.active } : u));

export const countActive = (users: readonly User[]): number => users.filter((u) => u.active).length;

// Try it: uncomment the line below. TypeScript reports
// "Property 'push' does not exist on type 'readonly User[]'".
// export const addUserWrong = (users: readonly User[], u: User) => users.push(u);
