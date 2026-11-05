import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Layout } from './core/layout/layout';
import { PlaygroundPage } from './features/playground/playground-page';
import { StudentsPage } from './features/students/students-page';

// Phase 3: two sections on one page. Phase 7 gives each one its own route.
@Component({
  selector: 'app-root',
  imports: [Layout, StudentsPage, PlaygroundPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-layout appName="RedStarVibe">
      <app-students-page />
      <app-playground-page />
    </app-layout>
  `,
})
export class App {}
