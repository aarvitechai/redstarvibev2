import StudentList from '../components/students/StudentList';
import { students } from '../data/students'; // named import (data), vs default import (components)

// A page = a component that puts the pieces together for one screen.
export default function StudentsPage() {
  const activeCount = students.filter((s) => s.isActive).length; // derived from the data, not stored

  return (
    <section id="students">
      <h1>Students</h1>
      <p>{activeCount} of {students.length} active</p>
      <StudentList students={students} />
    </section>
  );
}
