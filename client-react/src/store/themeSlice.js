import { createSlice } from '@reduxjs/toolkit';

export const THEME_KEY = 'redstar.theme';

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;

// Phase 14: a saved choice wins over the OS preference
function savedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

// Phase 9: the theme moves from Context (Phase 4) into Redux, because it's app-wide client state.
// The DOM update (<html data-theme>) is a side effect, so it lives in <ThemeSync />, not here.
const themeSlice = createSlice({
  name: 'theme',
  initialState: () => ({ mode: savedTheme() ?? (prefersDark() ? 'dark' : 'light') }),
  reducers: {
    themeToggled: (state) => {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
    },
    themeSet: (state, { payload }) => {
      if (payload === 'dark' || payload === 'light') state.mode = payload;
    },
  },
});

export const { themeToggled, themeSet } = themeSlice.actions;
export default themeSlice.reducer;
export const selectTheme = (state) => state.theme.mode;
