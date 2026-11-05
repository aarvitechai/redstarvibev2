import { useReducer, useState } from 'react';
import AddStudentForm from '../components/students/AddStudentForm';
import StudentList from '../components/students/StudentList';
import StudentStats from '../components/students/StudentStats';
import {
  studentAdded,
  studentRemoved,
  studentsReducer,
  studentToggled,
} from '../components/students/studentsReducer';
import { students as initialStudents } from '../data/students';

// LIFTING STATE UP: the form, the stats and the list are siblings that all need the same students.
// So the state lives in their closest common parent (this page) and flows down as props.
// Changes flow back up as callbacks: onAdd, onToggle, onRemove.
export default function StudentsPage() {
  // useReducer: the list changes in several ways (add / toggle / remove), so keep all the rules in one reducer
  const [students, dispatch] = useReducer(studentsReducer, initialStudents);
  // useState: a single, simple UI value
  const [activeOnly, setActiveOnly] = useState(false);

  // DERIVED state: computed on each render, never stored in its own useState (it would get out of sync)
  const visible = activeOnly ? students.filter((s) => s.isActive) : students;

  return (
    <section id="students">
      <h1>Students</h1>
      <StudentStats students={students} />

      <AddStudentForm onAdd={(student) => dispatch(studentAdded(student))} />

      <label>
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />{' '}
        Show active only
      </label>

      <StudentList
        students={visible}
        onToggle={(id) => dispatch(studentToggled(id))}
        onRemove={(id) => dispatch(studentRemoved(id))}
        emptyMessage={activeOnly ? 'No active students.' : 'No students yet.'}
      />
    </section>
  );
}
