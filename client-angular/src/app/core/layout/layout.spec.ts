import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Layout } from './layout';

@Component({ template: `<p class="page">Page content</p>` })
class FakePage {}

describe('Layout (the shell with <router-outlet>)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '', component: FakePage }])] });
  });

  it('renders header and footer around the routed page', async () => {
    const fixture = TestBed.createComponent(Layout);
    fixture.componentRef.setInput('appName', 'TestApp');
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('header')?.textContent).toContain('TestApp');
    expect(el.querySelector('footer')?.textContent).toContain(`© ${new Date().getFullYear()} TestApp`);
    expect(el.querySelector('main .page')?.textContent).toBe('Page content'); // inside <router-outlet>
  });

  it('the brand links home', async () => {
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('a.brand')?.getAttribute('href')).toBe('/');
  });
});
