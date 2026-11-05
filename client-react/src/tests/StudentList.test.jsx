import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StudentList from '../components/students/StudentList';
import { students } from '../data/students';

describe('StudentList', () => {
  it('renders one card per student', () => {
    render(<StudentList students={students} />);
    expect(screen.getAllByRole('article')).toHaveLength(students.length);
  });

  it('shows an empty state for an empty array', () => {
    render(<StudentList students={[]} />);
    expect(screen.getByText('No students yet.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
