import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Timer from '../components/playground/Timer';
import ThemeToggle from '../components/layout/ThemeToggle';
import ThemeProvider from '../context/ThemeProvider';
import MemoDemo from '../learning/phase-04/MemoDemo';
import DirectoryPage from '../pages/DirectoryPage';
import { callDetails, mockFetch, ok } from './fetchMock';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Timer (useEffect cleanup)', () => {
  it('ticks while running and stops on Stop', () => {
    vi.useFakeTimers();
    render(<Timer />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByLabelText('seconds')).toHaveTextContent('3s');

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByLabelText('seconds')).toHaveTextContent('3s');
  });

  it('clears the interval on unmount (no leak)', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(<Timer />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    unmount();
    expect(clearSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Theme (useContext)', () => {
  it('toggles the theme and syncs it to <html data-theme>', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('light'); // jsdom has no dark preference

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('throws a clear error without a Provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the error; keep the output clean
    expect(() => render(<ThemeToggle />)).toThrow('useTheme must be used inside <ThemeProvider>');
  });
});

describe('MemoDemo (measure re-renders)', () => {
  it('only memo + useCallback skips re-rendering when unrelated state changes', async () => {
    const user = userEvent.setup();
    render(<MemoDemo />);
    // StrictMode isn't used in tests, so the first render counts as 1
    const before = ['plain', 'memo + inline fn', 'memo + useCallback'].map((l) => Number(screen.getByTestId(l).textContent));

    await user.click(screen.getByRole('button', { name: /Unrelated \+1/ }));
    await user.click(screen.getByRole('button', { name: /Unrelated \+1/ }));

    expect(Number(screen.getByTestId('plain').textContent)).toBe(before[0] + 2);
    expect(Number(screen.getByTestId('memo + inline fn').textContent)).toBe(before[1] + 2); // memo was defeated
    expect(Number(screen.getByTestId('memo + useCallback').textContent)).toBe(before[2]);   // skipped
  });
});

describe('DirectoryPage (live API, debounced search)', () => {
  const students = [
    { id: 1, name: 'Asha Verma', email: 'a@x.com', course: 'Computer Science', year: 3, isActive: true },
    { id: 4, name: 'Arjun Singh', email: 'r@x.com', course: 'Computer Science', year: 1, isActive: true },
  ];

  it('loads on mount, focuses the search box, and sorts with useMemo', async () => {
    mockFetch(() => ok(students));
    render(<DirectoryPage />);

    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(await screen.findByText('2 results')).toBeInTheDocument();
    const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names()).toEqual(['Arjun Singh', 'Asha Verma']);

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'year' } });
    expect(names()).toEqual(['Arjun Singh', 'Asha Verma']); // year 1, then year 3
  });

  it('debounces typing into ONE request for the final term', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = mockFetch(() => ok(students));
    render(<DirectoryPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1)); // the initial load

    const box = screen.getByRole('searchbox');
    for (const term of ['c', 'co', 'com', 'comp']) {
      fireEvent.change(box, { target: { value: term } });
      act(() => vi.advanceTimersByTime(100)); // faster than the 300 ms debounce
    }
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((await callDetails(fetchMock, 1)).url).toContain('?search=comp');
  });

  it('shows an error with Retry when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<DirectoryPage />);
    // The Axios interceptor turns a failed connection into one friendly ApiError message
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load students: Network error: could not reach the server.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
