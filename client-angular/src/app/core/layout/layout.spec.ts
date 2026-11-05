import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Layout } from './layout';

// A tiny host component lets us test content projection (<ng-content>)
@Component({
  imports: [Layout],
  template: `<app-layout appName="TestApp"><p class="page">Page content</p></app-layout>`,
})
class Host {}

describe('Layout', () => {
  it('renders header, footer and the projected content', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('header')?.textContent).toContain('TestApp');
    expect(el.querySelector('footer')?.textContent).toContain(`© ${new Date().getFullYear()} TestApp`);
    expect(el.querySelector('main .page')?.textContent).toBe('Page content');
  });

  it('uses the default appName', async () => {
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('header')?.textContent).toContain('RedStarVibe');
  });
});
