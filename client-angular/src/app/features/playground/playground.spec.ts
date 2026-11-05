import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Counter } from './counter';
import { KeysDemo } from './keys-demo';

describe('Counter (signals)', () => {
  let fixture: ComponentFixture<Counter>;
  let el: HTMLElement;
  const count = () => el.querySelector('output')!.textContent!.trim();
  const click = async (text: string) => {
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.trim() === text)!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    fixture = TestBed.createComponent(Counter);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('increments, decrements and resets', async () => {
    await click('+ 1');
    await click('+ 1');
    expect(count()).toBe('2');
    expect(el.textContent).toContain('Even');
    await click('− 1');
    expect(count()).toBe('1');
    await click('Reset');
    expect(count()).toBe('0');
  });

  it('disables decrement below min', () => {
    const dec = Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('−'))!;
    expect(dec.disabled).toBe(true);
  });

  it('set(count() + 1) three times adds 3: signals update synchronously (unlike React state)', async () => {
    await click('+3 (set, works in Angular)');
    expect(count()).toBe('3');
  });

  it('update() three times also adds 3', async () => {
    await click('+3 (update)');
    expect(count()).toBe('3');
  });

  it('starts from the initial input (linkedSignal)', async () => {
    fixture.componentRef.setInput('initial', 7);
    await fixture.whenStable();
    expect(count()).toBe('7');
  });

  it('clamps the step to 1..10', async () => {
    const step = el.querySelector('input[type="number"]') as HTMLInputElement;
    step.value = '99';
    step.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(step.value).toBe('10');
    await click('+ 10');
    expect(count()).toBe('10');
  });
});

describe('KeysDemo (track $index vs track id)', () => {
  async function typeThenAddToTop(title: string) {
    const fixture = TestBed.createComponent(KeysDemo);
    await fixture.whenStable();
    const section = (fixture.nativeElement as HTMLElement).querySelector(`section[aria-label="${title}"]`) as HTMLElement;

    const asha = section.querySelector('input[aria-label="note for Asha"]') as HTMLInputElement;
    asha.value = 'hello';
    section.querySelector('button')!.click();
    await fixture.whenStable();

    const valueOf = (label: string) => (section.querySelector(`input[aria-label="note for ${label}"]`) as HTMLInputElement).value;
    return valueOf;
  }

  it('track $index: the typed text jumps to the NEW row (bug)', async () => {
    const valueOf = await typeThenAddToTop('track $index (buggy)');
    expect(valueOf('New #3')).toBe('hello');
    expect(valueOf('Asha')).toBe('');
  });

  it('track item.id: the typed text stays with Asha (correct)', async () => {
    const valueOf = await typeThenAddToTop('track item.id (correct)');
    expect(valueOf('Asha')).toBe('hello');
    expect(valueOf('New #3')).toBe('');
  });
});
