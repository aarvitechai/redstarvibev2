import { createSlice } from '@reduxjs/toolkit';

// The smallest possible slice: the "hello world" of Redux (Project 4).
// createSlice generates the ACTION CREATORS and the REDUCER from one object.
const counterSlice = createSlice({
  name: 'counter', // action types become "counter/incremented", "counter/amountAdded", ...
  initialState: { value: 0 },
  reducers: {
    // These LOOK like mutations, but Immer records them on a draft and produces a NEW immutable state.
    // This works ONLY inside createSlice / createReducer. Outside a slice, mutating state is still a bug.
    incremented: (state) => {
      state.value += 1;
    },
    decremented: (state) => {
      state.value -= 1;
    },
    amountAdded: (state, action) => {
      state.value += action.payload; // dispatch(amountAdded(5)) -> { type: 'counter/amountAdded', payload: 5 }
    },
    reset: () => ({ value: 0 }), // or RETURN a whole new state (don't mutate AND return in the same reducer)
  },
});

export const { incremented, decremented, amountAdded, reset } = counterSlice.actions;
export default counterSlice.reducer;

// A SELECTOR: a function that reads one thing from the whole state. Components never reach into state directly.
export const selectCount = (state) => state.counter.value;
