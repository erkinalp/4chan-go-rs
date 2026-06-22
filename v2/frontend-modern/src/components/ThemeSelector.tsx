import React from 'react';
import { useTheme, ThemeName } from '@/contexts/ThemeContext';

const THEMES: { value: ThemeName; label: string }[] = [
  { value: 'yotsuba', label: 'Yotsuba' },
  { value: 'yotsuba-b', label: 'Yotsuba B' },
  { value: 'futaba', label: 'Futaba' },
  { value: 'burichan', label: 'Burichan' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'photon', label: 'Photon' },
];

const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemeName)}
      style={{
        padding: '4px 8px',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        backgroundColor: 'var(--input-bg)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        cursor: 'pointer',
      }}
      aria-label="Select theme"
    >
      {THEMES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
};

export default ThemeSelector;
