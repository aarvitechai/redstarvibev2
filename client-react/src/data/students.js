// Phase 2: static data with the SAME shape as the API's StudentDto (GET /api/students -> data).
// Phase 4 (useEffect) / Phase 6 (Axios) replace this with a real API call.
export const students = [
  { id: 1, name: 'Asha Verma', email: 'asha@example.com', course: 'Computer Science', year: 3, isActive: true },
  { id: 2, name: 'Ravi Kumar', email: 'ravi@example.com', course: 'Mechanical', year: 2, isActive: true },
  { id: 3, name: 'Meera Shah', email: 'meera@example.com', course: 'Electronics', year: 4, isActive: false },
  { id: 4, name: 'Arjun Singh', email: 'arjun@example.com', course: 'Computer Science', year: 1, isActive: true },
];
