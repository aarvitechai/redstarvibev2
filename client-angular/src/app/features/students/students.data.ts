import { Student } from './student.model';

// Phase 2: static data. Later phases load it with HttpClient from GET /api/students.
export const STUDENTS: readonly Student[] = [
  { id: 1, name: 'Asha Verma', email: 'asha@example.com', course: 'Computer Science', year: 3, isActive: true },
  { id: 2, name: 'Ravi Kumar', email: 'ravi@example.com', course: 'Mechanical', year: 2, isActive: true },
  { id: 3, name: 'Meera Shah', email: 'meera@example.com', course: 'Electronics', year: 4, isActive: false },
  { id: 4, name: 'Arjun Singh', email: 'arjun@example.com', course: 'Computer Science', year: 1, isActive: true },
];
