import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

// Angular's version of React Context: an injectable SERVICE.
// providedIn: 'root' = ONE shared instance for the whole app. Any component can inject() it,
// with no prop drilling and no Provider component to wrap around the app.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  private readonly _theme = signal<Theme>(this.prefersDark() ? 'dark' : 'light');
  readonly theme = this._theme.asReadonly(); // consumers can read it, but only the service can change it

  constructor() {
    // effect() = React's useEffect for signals: it re-runs whenever a signal it reads changes.
    // Use it to SYNCHRONISE with something outside Angular (here, the <html> element).
    effect(() => {
      this.document.documentElement.dataset['theme'] = this._theme();
    });
  }

  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private prefersDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;
  }
}
