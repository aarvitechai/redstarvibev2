import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FavouriteToggle } from './favourite-toggle';
import { Contact } from './contacts-api';

export type ContactRow = Contact & { pending?: boolean };

@Component({
  selector: 'app-contact-item',
  imports: [FavouriteToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'listitem',
    class: 'item',
    '[class.pending]': 'contact().pending',
    '[attr.aria-label]': 'contact().name',
    '[attr.aria-busy]': 'contact().pending || null',
  },
  template: `
    @let c = contact();
    @let off = busy() || !!c.pending;
    <!-- Outside a form: plain two-way binding through the toggle's model() -->
    <app-favourite-toggle [value]="c.isFavourite" (valueChange)="favourite.emit(c)" [disabled]="off" [label]="'Favourite ' + c.name" />
    <div class="item-body">
      <strong>{{ c.name }}</strong>
      <span class="muted">{{ c.email }}@if (c.phone) { · {{ c.phone }} }</span>
      @if (c.pending) { <span class="muted">Saving…</span> }
    </div>
    <div class="actions">
      @if (confirming()) {
        <button type="button" class="danger" (click)="remove.emit(c.id)" [disabled]="off">Confirm delete</button>
        <button type="button" class="btn" (click)="confirming.set(false)">Keep</button>
      } @else {
        <button type="button" class="btn" (click)="edit.emit(c.id)" [disabled]="off">Edit</button>
        <button type="button" class="btn" (click)="confirming.set(true)" [disabled]="off">Delete</button>
      }
    </div>
  `,
  styleUrl: './contacts.scss',
})
export class ContactItem {
  readonly contact = input.required<ContactRow>();
  readonly busy = input(false);
  readonly favourite = output<Contact>();
  readonly edit = output<number>();
  readonly remove = output<number>();
  protected readonly confirming = signal(false); // a two-step delete
}
