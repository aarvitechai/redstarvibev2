import { createSlice } from '@reduxjs/toolkit';

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true;

// Phase 9: the theme moves from Context (Phase 4) into Redux, because it's app-wide client state.
// The DOM update (<html data-theme>) is a side effect, so it lives in <ThemeSync />, not here.
const themeSlice = createSlice({
  name: 'theme',
  initialState: () => ({ mode: prefersDark() ? 'dark' : 'light' }),
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
