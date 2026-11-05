// useReducer: ALL the ways the students list can change, in one pure function.
//   (currentState, action) => newState
// It's pure, with no side effects and no mutation, so it's trivial to test and works the same in Redux (Phase 9).

export const nextId = (students) => students.reduce((max, s) => Math.max(max, s.id), 0) + 1;

export function studentsReducer(students, action) {
  switch (action.type) {
    case 'added':
      return [...students, { ...action.student, id: nextId(students), isActive: true }];
    case 'toggled':
      return students.map((s) => (s.id === action.id ? { ...s, isActive: !s.isActive } : s));
    case 'removed':
      return students.filter((s) => s.id !== action.id);
    default:
      // Fail loudly on a typo such as 'remove' instead of silently doing nothing
      throw new Error(`Unknown action: ${action.type}`);
  }
}

// Action creators: one place that knows each action's shape
export const studentAdded = (student) => ({ type: 'added', student });
export const studentToggled = (id) => ({ type: 'toggled', id });
export const studentRemoved = (id) => ({ type: 'removed', id });
