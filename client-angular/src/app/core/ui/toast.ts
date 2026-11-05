import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

export interface Toast {
  readonly id: number;
  readonly kind: 'success' | 'error';
  readonly text: string;
}

// A tiny toast service: the Angular counterpart of react-toastify. Any component injects it and calls success()/error().
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<readonly Toast[]>([]);

  success(text: string): void {
    this.show('success', text);
  }
  error(text: string): void {
    this.show('error', text);
  }
  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(kind: Toast['kind'], text: string): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}

// Rendered once, in the Layout. aria-live: screen readers announce new toasts without moving the focus.
@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of service.toasts(); track t.id) {
        <div class="toast" [class.error]="t.kind === 'error'" [attr.role]="t.kind === 'error' ? 'alert' : 'status'">
          <span>{{ t.text }}</span>
          <button type="button" (click)="service.dismiss(t.id)" aria-label="Dismiss">✕</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 30; max-width: calc(100vw - 32px); }
    .toast { display: flex; gap: 12px; align-items: center; padding: 10px 14px; border-radius: 10px; background: var(--success); color: #fff; box-shadow: 0 4px 16px rgb(0 0 0 / 25%); }
    .toast.error { background: var(--primary); }
    button { background: none; border: 0; color: inherit; cursor: pointer; font: inherit; }
  `,
})
export class Toasts {
  protected readonly service = inject(ToastService);
}
