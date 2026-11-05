import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, input, output } from '@angular/core';

let modalCount = 0;

// An ACCESSIBLE modal (the same behaviour as the React one): role="dialog", aria-modal, a labelled title,
// focus moved to the first FIELD on open and given back to the opener on close, and Escape to close.
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (mousedown)="$event.target === $event.currentTarget && closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-labelledby]="titleId">
        <header class="head">
          <h2 [id]="titleId">{{ title() }}</h2>
          <button type="button" class="icon" (click)="closed.emit()" aria-label="Close">✕</button>
        </header>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / 45%); display: grid; place-items: center; padding: 16px; z-index: 20; }
    .modal { background: var(--surface); color: var(--text); border-radius: var(--radius); width: min(560px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; padding: 16px 20px; box-shadow: 0 10px 40px rgb(0 0 0 / 30%); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    h2 { margin: 0; font-size: 1.125rem; }
    .icon { font: inherit; background: none; border: 0; cursor: pointer; color: var(--muted); padding: 4px 8px; }
  `,
})
export class Modal implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  protected readonly titleId = `modal-title-${++modalCount}`;
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly opener = document.activeElement as HTMLElement | null; // who opened us

  ngAfterViewInit(): void {
    const el = this.host.nativeElement as HTMLElement;
    // Focus the first FIELD (not the ✕ in the header); fall back to the first button outside the header
    const target = el.querySelector<HTMLElement>('input, select, textarea') ?? el.querySelector<HTMLElement>('.modal > :not(header) button');
    target?.focus();
  }

  ngOnDestroy(): void {
    this.opener?.focus?.(); // give focus back, so keyboard users don't get lost
  }
}
