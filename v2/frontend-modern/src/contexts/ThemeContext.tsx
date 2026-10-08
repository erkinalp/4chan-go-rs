import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ThemeName =
  | 'yotsuba'
  | 'yotsuba-b'
  | 'futaba'
  | 'burichan'
  | 'tomorrow'
  | 'photon';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const STORAGE_KEY = '4chan-theme';
const DEFAULT_THEME: ThemeName = 'yotsuba';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): ThemeName {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isValidTheme(stored)) {
    return stored;
  }
  return DEFAULT_THEME;
}

function isValidTheme(value: string): value is ThemeName {
  return ['yotsuba', 'yotsuba-b', 'futaba', 'burichan', 'tomorrow', 'photon'].includes(value);
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
