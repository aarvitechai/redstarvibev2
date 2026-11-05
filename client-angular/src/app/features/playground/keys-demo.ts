import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

// WHY "track $index" BREAKS (the same bug as React's key={index}).
// Type into the first row, then click "Add to top":
//  - track $index: Angular reuses row 0's DOM (with your typed text) and just changes its label.
//  - track item.id: Angular moves the DOM row together with its item.
interface Item {
  id: number;
  label: string;
}

@Component({
  selector: 'app-note-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section [attr.aria-label]="title()">
      <h3>{{ title() }}</h3>
      <button type="button" (click)="addToTop()">Add to top</button>
      <ul>
        @if (trackByIndex()) {
          @for (item of items(); track $index) {
            <li>{{ item.label }}: <input [attr.aria-label]="'note for ' + item.label" placeholder="type a note" /></li>
          }
        } @else {
          @for (item of items(); track item.id) {
            <li>{{ item.label }}: <input [attr.aria-label]="'note for ' + item.label" placeholder="type a note" /></li>
          }
        }
      </ul>
    </section>
  `,
})
export class NoteList {
  readonly title = input.required<string>();
  readonly trackByIndex = input(false);

  protected readonly items = signal<Item[]>([
    { id: 1, label: 'Asha' },
    { id: 2, label: 'Ravi' },
  ]);
  private nextId = 3;

  protected addToTop(): void {
    const id = this.nextId++;
    this.items.update((prev) => [{ id, label: `New #${id}` }, ...prev]);
  }
}

@Component({
  selector: 'app-keys-demo',
  imports: [NoteList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      <app-note-list title="track $index (buggy)" [trackByIndex]="true" />
      <app-note-list title="track item.id (correct)" />
    </div>
  `,
  styles: `.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }`,
})
export class KeysDemo {}
