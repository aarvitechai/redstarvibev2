import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the layout with the students page inside', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('header')?.textContent).toContain('RedStarVibe');
    expect(el.querySelector('main h1')?.textContent).toBe('Students');
    expect(el.querySelectorAll('[role="article"]').length).toBe(4);
  });
});
