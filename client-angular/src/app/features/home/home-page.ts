import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1>RedStarVibe</h1>
      <p class="muted">A full-stack learning project: React, Angular and .NET, built phase by phase.</p>
      <ul class="cards">
        @for (s of sections; track s.path) {
          <li>
            <a class="card" [routerLink]="s.path"><strong>{{ s.title }}</strong><span class="muted">{{ s.text }}</span></a>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrl: '../products/products.scss',
})
export class HomePage {
  protected readonly sections = [
    { path: '/products', title: 'Products', text: 'Project 3: filter by category, search and sort, all kept in the URL.' },
    { path: '/destinations', title: 'Destinations', text: 'Project 5: httpResource, refetch after changes, paging and optimistic updates.' },
    { path: '/students', title: 'Students', text: 'Project 1: components, inputs/outputs, lifted state and a reducer.' },
    { path: '/directory', title: 'Directory', text: 'Phase 4: live API search with debounceTime and switchMap.' },
    { path: '/contacts', title: 'Contacts', text: 'Project 2: Reactive Forms, a custom control and optimistic updates.' },
    { path: '/playground', title: 'Playground', text: 'Counter, tracking and timer demos.' },
  ];
}
