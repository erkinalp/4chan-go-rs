import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AccessibilityState {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

const initialState: AccessibilityState = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
};

const accessibilitySlice = createSlice({
  name: 'accessibility',
  initialState,
  reducers: {
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
    },
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload;
    },
    setFontSize: (state, action: PayloadAction<'small' | 'medium' | 'large'>) => {
      state.fontSize = action.payload;
    },
  },
});

export const { setHighContrast, setReducedMotion, setFontSize } =
  accessibilitySlice.actions;
export default accessibilitySlice.reducer;
