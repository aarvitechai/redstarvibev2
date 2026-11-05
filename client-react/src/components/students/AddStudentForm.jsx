import { useState } from 'react';
import styles from './Students.module.css';

const EMPTY = { name: '', email: '', course: '', year: 1 };

// This form owns only its own DRAFT state (what's being typed).
// The real list lives in the parent. The form reports a finished student UP through the onAdd callback.
// (Phase 5 covers forms properly: validation, Actions and react-hook-form.)
export default function AddStudentForm({ onAdd }) {
  const [draft, setDraft] = useState(EMPTY);

  // One change handler for every input: use the input's `name` to update just that field
  function handleChange(event) {
    const { name, value } = event.target;
    setDraft((prev) => ({ ...prev, [name]: name === 'year' ? Number(value) : value }));
  }

  function handleSubmit(event) {
    event.preventDefault(); // stop the browser's full-page form submit
    onAdd({ ...draft, name: draft.name.trim(), email: draft.email.trim(), course: draft.course.trim() });
    setDraft(EMPTY);
  }

  const canSubmit = draft.name.trim() && draft.email.trim() && draft.course.trim();

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="Add student">
      <label>
        Name
        <input name="name" value={draft.name} onChange={handleChange} required />
      </label>
      <label>
        Email
        <input name="email" type="email" value={draft.email} onChange={handleChange} required />
      </label>
      <label>
        Course
        <input name="course" value={draft.course} onChange={handleChange} required />
      </label>
      <label>
        Year
        <select name="year" value={draft.year} onChange={handleChange}>
          {[1, 2, 3, 4, 5].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>
        Add student
      </button>
    </form>
  );
}
