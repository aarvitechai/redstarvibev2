import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, scan, startWith, switchMap } from 'rxjs';
import { StudentList } from '../students/student-list';
import { Student } from '../students/student.model';
import { StudentsApi } from '../students/students-api';

interface DirectoryState {
  loading: boolean;
  students: Student[];
  error: string | null;
}
const INITIAL: DirectoryState = { loading: true, students: [], error: null };

// Phase 4: the FIRST Angular page that talks to the real API (GET /api/students?search=).
@Component({
  selector: 'app-directory-page',
  imports: [StudentList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './directory-page.html',
  styleUrl: './directory-page.scss',
})
export class DirectoryPage {
  private readonly api = inject(StudentsApi);

  protected readonly search = signal('');
  protected readonly sortBy = signal<'name' | 'year'>('name');
  private readonly reloadTick = signal(0);

  // viewChild = useRef for a DOM element in the template (#searchBox)
  private readonly searchBox = viewChild.required<ElementRef<HTMLInputElement>>('searchBox');

  // THE PIPELINE (React needed useDebouncedValue + useEffect + AbortController for the same thing):
  //   signal -> Observable -> wait 300 ms of quiet -> skip repeats -> switchMap to the request
  // switchMap UNSUBSCRIBES from the previous request when a new term arrives,
  // which cancels it. So a slow old response can never overwrite a newer one.
  private readonly request = computed(() => ({ term: this.search().trim(), tick: this.reloadTick() }));

  protected readonly state = toSignal(
    toObservable(this.request).pipe(
      debounceTime(300),
      distinctUntilChanged((a, b) => a.term === b.term && a.tick === b.tick),
      switchMap(({ term }) =>
        this.api.search(term).pipe(
          map((students): Partial<DirectoryState> => ({ loading: false, students, error: null })),
          catchError((err: Error) => of<Partial<DirectoryState>>({ loading: false, students: [], error: err.message })),
          startWith<Partial<DirectoryState>>({ loading: true, error: null }), // keep the old students while loading
        ),
      ),
      scan((prev, next) => ({ ...prev, ...next }), INITIAL),
    ),
    { initialValue: INITIAL },
  );

  // computed = useMemo: re-sorts only when the students or sortBy change
  protected readonly sorted = computed(() => {
    const by = this.sortBy();
    return [...this.state().students].sort((a, b) => (by === 'year' ? a.year - b.year : a.name.localeCompare(b.name)));
  });

  protected readonly emptyMessage = computed(() =>
    this.state().loading ? '' : `No students match "${this.search().trim()}".`,
  );

  constructor() {
    // afterNextRender = useEffect(..., []) for DOM work: runs once, after the first render, in the browser only
    afterNextRender(() => this.searchBox().nativeElement.focus());
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as 'name' | 'year');
  }

  protected reload(): void {
    this.reloadTick.update((n) => n + 1);
  }
}
