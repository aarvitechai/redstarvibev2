import { Link } from 'react-router';
import { ROUTES } from '../constants/routes';
import styles from './products/Products.module.css';

const SECTIONS = [
  { to: ROUTES.products, title: 'Products', text: 'Project 3: filter by category, search and sort, all kept in the URL.' },
  { to: ROUTES.students, title: 'Students', text: 'Project 1: components, props, lifted state and a reducer.' },
  { to: ROUTES.directory, title: 'Directory', text: 'Phase 4: live API search with debouncing and cancellation.' },
  { to: ROUTES.contacts, title: 'Contacts', text: 'Project 2: forms three ways, Actions and optimistic updates.' },
  { to: ROUTES.playground, title: 'Playground', text: 'Counter, keys, timer and memo demos.' },
];

export default function HomePage() {
  return (
    <section>
      {/* React 19: a <title> anywhere in the tree is moved into <head> automatically */}
      <title>Home · RedStarVibe</title>
      <h1>RedStarVibe</h1>
      <p className={styles.muted}>A full-stack learning project: React, Angular and .NET, built phase by phase.</p>
      <ul className={styles.cards}>
        {SECTIONS.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className={styles.card}>
              <strong>{s.title}</strong>
              <span className={styles.muted}>{s.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
