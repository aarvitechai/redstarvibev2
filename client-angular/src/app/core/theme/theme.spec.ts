import { TestBed } from '@angular/core/testing';
import { Timer } from '../../features/playground/timer';
import { ThemeToggle } from '../layout/theme-toggle';
import { ThemeService } from './theme.service';

describe('ThemeService (DI instead of Context)', () => {
  it('is a singleton: every inject() gets the same instance', () => {
    expect(TestBed.inject(ThemeService)).toBe(TestBed.inject(ThemeService));
  });

  it('the toggle flips the theme, and the effect syncs <html data-theme>', async () => {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).toBe('light');

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
    button.click();
    await fixture.whenStable();

    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
  });
});

describe('Timer (effect cleanup)', () => {
  afterEach(() => vi.useRealTimers());

  it('ticks while running, stops on Stop, and clears the interval on destroy', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Timer);
    const el = fixture.nativeElement as HTMLElement;
    const btn = (text: string) => Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!;
    fixture.detectChanges();

    btn('Start').click();
    fixture.detectChanges(); // runs the effect, which starts the interval
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('output')!.textContent).toBe('3s');

    btn('Stop').click();
    fixture.detectChanges(); // the effect re-runs, and the cleanup clears the interval
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(el.querySelector('output')!.textContent).toBe('3s');

    btn('Start').click();
    fixture.detectChanges();
    expect(vi.getTimerCount()).toBe(1);
    fixture.destroy(); // destroying the component runs onCleanup
    expect(vi.getTimerCount()).toBe(0);
  });
});
