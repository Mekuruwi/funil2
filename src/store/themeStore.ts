import { create } from 'zustand';
import type { Theme } from '../types';

export type ThemeStyle = 'corporativo' | 'oceano' | 'floresta' | 'violeta' | 'terracota' | 'personalizado';
export interface CustomThemeColors {
  light: { accent: string; background: string };
  dark: { accent: string; background: string };
}

export const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  light: { accent: '#1B2A4E', background: '#FFFFFF' },
  dark: { accent: '#818CF8', background: '#111827' },
};

const validStyles: ThemeStyle[] = ['corporativo', 'oceano', 'floresta', 'violeta', 'terracota', 'personalizado'];
const readTheme = (): Theme => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
  if (saved === 'light' || saved === 'dark') return saved;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const readStyle = (): ThemeStyle => {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('theme-style') : null;
  return validStyles.includes(saved as ThemeStyle) ? saved as ThemeStyle : 'corporativo';
};
const readCustomColors = (): CustomThemeColors => {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_COLORS;
  try {
    const parsed = JSON.parse(localStorage.getItem('theme-custom-colors') || 'null') as CustomThemeColors | null;
    if (parsed?.light?.accent && parsed.light.background && parsed.dark?.accent && parsed.dark.background) return parsed;
  } catch { /* usa as cores padrão */ }
  return DEFAULT_CUSTOM_COLORS;
};

const applyAppearance = (theme: Theme, style: ThemeStyle, customColors: CustomThemeColors) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.themeStyle = style;
  ['--accent-color', '--bg-primary', '--bg-secondary', '--text-primary', '--text-secondary', '--border-color'].forEach(property => root.style.removeProperty(property));
  if (style === 'personalizado') {
    const colors = customColors[theme];
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--bg-primary', colors.background);
    root.style.setProperty('--bg-secondary', 'color-mix(in srgb, ' + colors.background + ', ' + (theme === 'dark' ? '#FFFFFF' : '#000000') + ' 6%)');
    root.style.setProperty('--text-primary', theme === 'dark' ? '#F9FAFB' : '#172033');
    root.style.setProperty('--text-secondary', theme === 'dark' ? '#B8C0D4' : '#5B6474');
    root.style.setProperty('--border-color', 'color-mix(in srgb, ' + colors.background + ', ' + (theme === 'dark' ? '#FFFFFF' : '#000000') + ' 16%)');
  }
};

interface ThemeStore {
  theme: Theme;
  style: ThemeStyle;
  customColors: CustomThemeColors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setStyle: (style: ThemeStyle) => void;
  setCustomColors: (colors: CustomThemeColors) => void;
}

const initialTheme = readTheme();
const initialStyle = readStyle();
const initialCustomColors = readCustomColors();
applyAppearance(initialTheme, initialStyle, initialCustomColors);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  style: initialStyle,
  customColors: initialCustomColors,
  toggleTheme: () => {
    const theme = get().theme === 'light' ? 'dark' : 'light';
    const { style, customColors } = get();
    applyAppearance(theme, style, customColors);
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setTheme: (theme) => {
    const { style, customColors } = get();
    applyAppearance(theme, style, customColors);
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setStyle: (style) => {
    const { theme, customColors } = get();
    applyAppearance(theme, style, customColors);
    localStorage.setItem('theme-style', style);
    set({ style });
  },
  setCustomColors: (customColors) => {
    const { theme } = get();
    applyAppearance(theme, 'personalizado', customColors);
    localStorage.setItem('theme-style', 'personalizado');
    localStorage.setItem('theme-custom-colors', JSON.stringify(customColors));
    set({ style: 'personalizado', customColors });
  },
}));
