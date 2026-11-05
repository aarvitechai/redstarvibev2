import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Session } from '../../core/auth/session';
import { ApiError, toApiError } from '../../core/http/api';
import { DestinationForm } from './destination-form';
import { Destination, DestinationsApi, Paged, SaveDestination } from './destinations-api';

// Project 5 (Angular): Destination Manager with httpResource.
// The URL holds page / q / visited (bound as inputs). The resource reloads whenever they change, or when a
// mutation bumps the API's version signal (our "tag invalidation").
@Component({
  selector: 'app-destinations-page',
  imports: [DestinationForm, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './destinations-page.html',
  styleUrl: './destinations.scss',
})
export class DestinationsPage {
  private readonly api = inject(DestinationsApi);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  readonly page = input<string>();
  readonly q = input<string>();
  readonly visited = input<string>();

  protected readonly query = computed(() => ({
    page: Math.max(1, Number(this.page()) || 1),
    search: this.q() ?? '',
    visited: (this.visited() === 'true' || this.visited() === 'false' ? this.visited() : '') as '' | 'true' | 'false',
  }));

  // httpResource: value() / isLoading() / error() / reload(). It tracks query() AND the API's version signal.
  protected readonly list = this.api.list(this.query);

  protected readonly data = computed<Paged<Destination> | undefined>(() => (this.list.hasValue() ? this.list.value() : undefined));
  protected readonly errorMessage = computed(() => (this.list.error() ? toApiError(this.list.error()).message : null));
  protected readonly range = computed(() => {
    const d = this.data();
    if (!d || d.totalCount === 0) return 'No destinations match.';
    const from = (d.page - 1) * d.pageSize + 1;
    return `Showing ${from}–${from + d.items.length - 1} of ${d.totalCount}`;
  });

  protected readonly searchBox = linkedSignal(() => this.q() ?? '');
  private readonly typing = new Subject<string>();
  protected readonly editingId = signal<number | null>(null);
  protected readonly confirmingId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);

  constructor() {
    this.typing
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.navigate({ q: value.trim() || null, page: null }, true));
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchBox.set(value);
    this.typing.next(value);
  }

  protected onVisitedFilter(event: Event): void {
    this.navigate({ visited: (event.target as HTMLSelectElement).value || null, page: null });
  }

  protected goTo(page: number): void {
    this.navigate({ page: page > 1 ? String(page) : null });
  }

  // Bound as an arrow property so `this` works when the form calls it
  protected readonly create = (body: SaveDestination) => this.api.create(body);
  protected updateFor(id: number) {
    return (body: SaveDestination) => this.api.update(id, body);
  }

  protected remove(id: number): void {
    this.actionError.set(null);
    this.api.remove(id).subscribe({ error: (e: ApiError) => this.actionError.set(e.message) });
  }

  // OPTIMISTIC: change the resource's value NOW, then roll back to the snapshot if the server refuses
  protected toggleVisited(d: Destination, isVisited: boolean): void {
    const snapshot = this.list.value();
    this.list.update((page) => page && { ...page, items: page.items.map((x) => (x.id === d.id ? { ...x, isVisited } : x)) });
    this.api.setVisited(d.id, isVisited).subscribe({
      error: (e: ApiError) => {
        if (e.status !== 401) this.list.set(snapshot); // on 401 the session logs out; nothing to restore
        this.actionError.set(e.message);
      },
    });
  }

  protected stars(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  private navigate(queryParams: Record<string, string | null>, replaceUrl = false): void {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl });
  }
}
