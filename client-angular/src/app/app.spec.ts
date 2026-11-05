import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    // The Directory page uses HttpClient. The testing backend means no real network calls are made.
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('renders the layout with the students page inside', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('header')?.textContent).toContain('RedStarVibe');
    expect(el.querySelector('main h1')?.textContent).toBe('Students');
    expect(el.querySelectorAll('#students [role="article"]').length).toBe(4);
    expect(el.querySelector('#directory h2')?.textContent).toBe('Directory (live API)');
  });
});
