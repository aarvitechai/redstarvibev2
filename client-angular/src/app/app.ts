import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Layout } from './core/layout/layout';
import { StudentsPage } from './features/students/students-page';

// Phase 2: App = Layout + one page. Phase 7 adds routing.
@Component({
  selector: 'app-root',
  imports: [Layout, StudentsPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout appName="RedStarVibe">
      <app-students-page />
    </app-layout>
  `,
})
export class App {}
