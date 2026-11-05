import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Layout } from './core/layout/layout';
import { PlaygroundPage } from './features/playground/playground-page';
import { ContactsPage } from './features/contacts/contacts-page';
import { DirectoryPage } from './features/directory/directory-page';
import { StudentsPage } from './features/students/students-page';

// Phase 5: four sections on one page. Phase 7 gives each one its own route.
@Component({
  selector: 'app-root',
  imports: [Layout, StudentsPage, DirectoryPage, ContactsPage, PlaygroundPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout appName="RedStarVibe">
      <app-students-page />
      <app-directory-page />
      <app-contacts-page />
      <app-playground-page />
    </app-layout>
  `,
})
export class App {}
