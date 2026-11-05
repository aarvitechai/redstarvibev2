import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { ContactForm } from './contact-form';
import { ContactItem, ContactRow } from './contact-item';
import { Contact, ContactPayload, ContactsApi } from './contacts-api';

// The same order as the API: favourites first, then by name
const sortContacts = (list: ContactRow[]): ContactRow[] =>
  [...list].sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite) || a.name.localeCompare(b.name));

let pendingSeq = 0;

// Project 2: Contact List (Angular). Add + edit with Reactive Forms, favourite, delete, and an OPTIMISTIC add.
@Component({
  selector: 'app-contacts-page',
  imports: [ContactForm, ContactItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section>
      <h1>Contacts</h1>
      <app-contact-form [save]="createOptimistically" />

      @if (actionError()) { <p role="alert" class="form-error">{{ actionError() }}</p> }
      @if (loading()) { <p class="muted">Loading contacts…</p> }
      @if (loadError()) { <p role="alert" class="form-error">Could not load contacts: {{ loadError() }}</p> }
      @if (!loading() && !loadError() && contacts().length === 0) { <p class="muted">No contacts yet.</p> }

      <ul class="list" aria-label="Contacts">
        @for (c of contacts(); track c.id) {
          @if (c.id === editingId()) {
            <li class="item">
              <app-contact-form [contact]="c" [save]="updateFor(c.id)" (saved)="editingId.set(null)" (cancelled)="editingId.set(null)" />
            </li>
          } @else {
            <app-contact-item [contact]="c" [busy]="busyId() === c.id"
                              (favourite)="toggleFavourite($event)" (edit)="editingId.set($event)" (remove)="remove($event)" />
          }
        }
      </ul>
    </section>
  `,
  styleUrl: './contacts.scss',
})
export class ContactsPage {
  private readonly api = inject(ContactsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly contacts = signal<ContactRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly editingId = signal<number | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  constructor() {
    this.api
      .list()
      .pipe(takeUntilDestroyed()) // unsubscribe (and cancel) if the page is destroyed first
      .subscribe({
        next: (list) => {
          this.contacts.set(sortContacts(list));
          this.loading.set(false);
        },
        error: (e: ApiError) => {
          this.loadError.set(e.message);
          this.loading.set(false);
        },
      });
  }

  // OPTIMISTIC ADD (what React's useOptimistic does, done by hand):
  //   1. show a temporary "pending" row immediately
  //   2. success -> swap it for the real contact from the server
  //   3. failure -> remove it (roll back) and rethrow, so the form shows the field errors
  // An arrow function property, so `this` still works when the form calls it.
  protected readonly createOptimistically = (payload: ContactPayload): Observable<Contact> => {
    const tempId = -++pendingSeq; // negative ids can never clash with real ones
    const temp: ContactRow = { ...payload, id: tempId, createdAt: new Date().toISOString(), pending: true };
    this.contacts.update((list) => sortContacts([...list, temp]));

    return this.api.create(payload).pipe(
      tap((created) => this.contacts.update((list) => sortContacts(list.map((c) => (c.id === tempId ? created : c))))),
      catchError((error: unknown) => {
        this.contacts.update((list) => list.filter((c) => c.id !== tempId));
        return throwError(() => error);
      }),
    );
  };

  protected updateFor(id: number): (payload: ContactPayload) => Observable<Contact> {
    return (payload) => this.api.update(id, payload).pipe(tap((updated) => this.replace(updated)));
  }

  protected toggleFavourite(contact: Contact): void {
    this.run(contact.id, this.api.setFavourite(contact.id, !contact.isFavourite), (updated) => this.replace(updated));
  }

  protected remove(id: number): void {
    this.run(id, this.api.remove(id), () => this.contacts.update((list) => list.filter((c) => c.id !== id)));
  }

  private replace(updated: Contact): void {
    this.contacts.update((list) => sortContacts(list.map((c) => (c.id === updated.id ? updated : c))));
  }

  private run<T>(id: number, request: Observable<T>, onSuccess: (value: T) => void): void {
    this.busyId.set(id);
    this.actionError.set(null);
    request
      .pipe(
        finalize(() => this.busyId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ next: onSuccess, error: (e: ApiError) => this.actionError.set(e.message) });
  }
}
