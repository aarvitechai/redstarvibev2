import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useStudents } from '../hooks/useStudents';
import { callDetails, fail, mockFetch, ok } from './fetchMock';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDebouncedValue', () => {
  it('only updates after the value stops changing for the delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'c' },
    });

    rerender({ value: 'co' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'comp' }); // typing again cancels the pending timer (cleanup)
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('c'); // still the old value: 300 ms haven't passed since the last change

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('comp');
  });
});

describe('useStudents (custom data hook)', () => {
  const asha = { id: 1, name: 'Asha Verma', email: 'a@x.com', course: 'CS', year: 3, isActive: true };

  it('goes loading -> data, and sends the search as a query string', async () => {
    const fetchMock = mockFetch(() => ok([asha]));
    const { result } = renderHook(() => useStudents('comp'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.students).toEqual([asha]);
    expect((await callDetails(fetchMock, 0)).url).toBe('http://localhost:5240/api/students?search=comp');
  });

  it('shows the server error message from the envelope', async () => {
    mockFetch(() => fail(400, 'search: too long'));
    const { result } = renderHook(() => useStudents('x'));

    await waitFor(() => expect(result.current.error).toBe('search: too long'));
    expect(result.current.students).toEqual([]);
  });

  it('aborts the previous request, so a slow old response can never overwrite a newer one', async () => {
    // "co" is SLOW (100 ms), "comp" is FAST (10 ms). Without abort, "co" would arrive last and win.
    const fetchMock = mockFetch((url) =>
      url.includes('comp') ? { ...ok([asha]), delayMs: 10 } : { ...ok([]), delayMs: 100 },
    );
    const { result, rerender } = renderHook(({ q }) => useStudents(q), { initialProps: { q: 'co' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // "co" is now really in flight
    rerender({ q: 'comp' });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await new Promise((r) => setTimeout(r, 150)); // give the old request time to (not) land

    const co = await callDetails(fetchMock, 0);
    expect(co.url).toMatch(/search=co$/);
    expect(co.signal.aborted).toBe(true); // the old request was cancelled mid-flight
    expect(result.current.students).toEqual([asha]); // the newest result wins
    expect(result.current.error).toBeNull(); // the AbortError is not shown as an error
  });

  it('aborts on unmount (no state updates after the component is gone)', async () => {
    const fetchMock = mockFetch(() => ({ ...ok([]), delayMs: 1000 }));
    const { unmount } = renderHook(() => useStudents(''));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled()); // Axios sends asynchronously (after the interceptors)
    unmount();
    expect((await callDetails(fetchMock, 0)).signal.aborted).toBe(true);
  });

  it('reload() fetches again', async () => {
    const fetchMock = mockFetch(() => ok([asha]));
    const { result } = renderHook(() => useStudents(''));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
