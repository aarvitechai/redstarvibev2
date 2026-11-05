import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authApi } from '../services/authApi';
import { getSession, saveSession } from '../services/session';

// Phase 9: auth moves from React Context (Phase 8) into Redux. The useAuth() hook keeps the SAME API,
// so Header, ProtectedRoute, LoginPage and AccountPage didn't change.

// createAsyncThunk: an async action. It dispatches auth/login/pending -> fulfilled OR rejected automatically.
// Side effects (the API call, saving to storage) live HERE, never in a reducer: reducers must stay pure.
export const loginUser = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const session = await authApi.login(email, password);
    saveSession(session); // the Axios interceptor reads the token from here
    return session;
  } catch (error) {
    // rejectWithValue sends a plain, serialisable message (Redux state must not hold Error objects)
    return rejectWithValue(error.message);
  }
});

// Phase 12: register = create the account AND sign in (the API returns the same session as login)
export const registerUser = createAsyncThunk('auth/register', async ({ name, email, password }, { rejectWithValue }) => {
  try {
    const session = await authApi.register(name, email, password);
    saveSession(session);
    return session;
  } catch (error) {
    // Keep the field errors (e.g. "email already exists") so the form can show them under the right input
    return rejectWithValue({ message: error.message, fieldErrors: error.fieldErrors ?? null });
  }
});

// The logout THUNK lives in store/sessionActions.js (it also clears the RTK Query cache).

const authSlice = createSlice({
  name: 'auth',
  // initialState as a FUNCTION: read when the store is created, after restoreSession() ran in main.jsx
  initialState: () => ({ session: getSession(), status: 'idle', error: null, logoutReason: null }),
  reducers: {
    // A token refresh (in an HTTP client or the expiry timer) produced a new session: mirror it into Redux
    sessionUpdated: (state, action) => {
      state.session = action.payload;
    },
    loggedOut: (state, action) => {
      state.session = null;
      state.status = 'idle';
      state.error = null;
      state.logoutReason = action.payload ?? null; // 'expired' | null
    },
  },
  // extraReducers: respond to actions defined ELSEWHERE (here, the thunk's lifecycle actions)
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.status = 'pending';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'idle';
        state.session = action.payload;
        state.logoutReason = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.session = action.payload;
        state.logoutReason = null;
      });
  },
});

export const { loggedOut, sessionUpdated } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (state) => state.auth.session?.user ?? null;
export const selectSession = (state) => state.auth.session;
export const selectLogoutReason = (state) => state.auth.logoutReason;
