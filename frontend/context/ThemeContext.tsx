/**
 * context/ThemeContext.tsx — Eventure v3
 *
 * Fournit un theme global jour/nuit persisté dans AsyncStorage.
 * Tous les composants accèdent aux couleurs via useTheme().
 * Compatible avec les palettes existantes (indigo light + dark futuristic).
 */
import React, {
  createContext, useCallback, useContext,
  useEffect, useState, type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─── Color tokens ─────────────────────────────────────────────────────── */

const DAY = {
  /* Brand */
  primary        : '#6366F1',
  primaryLight   : '#818CF8',
  primaryDark    : '#4F46E5',
  primaryGhost   : 'rgba(99,102,241,0.08)',
  primaryBorder  : 'rgba(99,102,241,0.22)',
  secondary      : '#8B5CF6',
  secondaryLight : '#A78BFA',
  accent         : '#06B6D4',
  accentLight    : '#22D3EE',

  /* Semantic */
  success        : '#10B981',
  successGhost   : 'rgba(16,185,129,0.10)',
  warning        : '#F59E0B',
  warningGhost   : 'rgba(245,158,11,0.10)',
  danger         : '#EF4444',
  dangerGhost    : 'rgba(239,68,68,0.10)',
  info           : '#3B82F6',
  infoGhost      : 'rgba(59,130,246,0.10)',

  /* Surfaces */
  background     : '#F9FAFB',
  backgroundAlt  : '#FFFFFF',
  surface        : '#FFFFFF',
  surfaceAlt     : '#F3F4F6',
  surfaceHover   : '#F9FAFB',

  /* Text */
  textPrimary    : '#1F2937',
  textSecondary  : '#6B7280',
  textMuted      : '#9CA3AF',
  textInverse    : '#FFFFFF',

  /* Border */
  border         : '#D1D5DB',
  borderLight    : '#E5E7EB',
  borderDark     : '#9CA3AF',

  /* Nav */
  navBg          : '#FFFFFF',
  navActive      : '#6366F1',
  navInactive    : '#9CA3AF',

  /* Gold / special */
  gold           : '#F59E0B',
  green          : '#10B981',
  red            : '#EF4444',
  blue           : '#3B82F6',
  purple         : '#8B5CF6',
} as const;

const NIGHT = {
  /* Brand — same primary */
  primary        : '#6366F1',
  primaryLight   : '#818CF8',
  primaryDark    : '#4F46E5',
  primaryGhost   : 'rgba(99,102,241,0.12)',
  primaryBorder  : 'rgba(99,102,241,0.28)',
  secondary      : '#8B5CF6',
  secondaryLight : '#A78BFA',
  accent         : '#06B6D4',
  accentLight    : '#22D3EE',

  /* Semantic — same */
  success        : '#10B981',
  successGhost   : 'rgba(16,185,129,0.12)',
  warning        : '#F59E0B',
  warningGhost   : 'rgba(245,158,11,0.12)',
  danger         : '#EF4444',
  dangerGhost    : 'rgba(239,68,68,0.12)',
  info           : '#3B82F6',
  infoGhost      : 'rgba(59,130,246,0.12)',

  /* Surfaces — dark navy */
  background     : '#0F172A',
  backgroundAlt  : '#1E293B',
  surface        : '#1E293B',
  surfaceAlt     : '#334155',
  surfaceHover   : '#293548',

  /* Text */
  textPrimary    : '#F1F5F9',
  textSecondary  : '#94A3B8',
  textMuted      : '#64748B',
  textInverse    : '#0F172A',

  /* Border */
  border         : '#334155',
  borderLight    : '#475569',
  borderDark     : '#1E293B',

  /* Nav */
  navBg          : '#1E293B',
  navActive      : '#6366F1',
  navInactive    : '#64748B',

  /* Gold / special */
  gold           : '#F59E0B',
  green          : '#10B981',
  red            : '#EF4444',
  blue           : '#3B82F6',
  purple         : '#8B5CF6',
} as const;

export type ColorTokens = typeof DAY;

export interface ThemeContextValue {
  colors       : ColorTokens;
  isDark       : boolean;
  toggleTheme  : () => void;
  setDark      : (dark: boolean) => void;
}

/* ─── Context ───────────────────────────────────────────────────────────── */

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = '@eventure:theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sys = useColorScheme();
  const [isDark, setIsDark] = useState(sys === 'dark');
  const [ready, setReady]   = useState(false);

  /* Load saved preference */
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(v => {
        if (v === 'dark' || v === 'light') setIsDark(v === 'dark');
        else setIsDark(sys === 'dark');
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  /* Persist on change */
  const setDark = useCallback((dark: boolean) => {
    setIsDark(dark);
    AsyncStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light').catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => setDark(!isDark), [isDark, setDark]);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ colors: isDark ? NIGHT : DAY, isDark, toggleTheme, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ─── Hooks ─────────────────────────────────────────────────────────────── */

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Convenience hook — returns only the color tokens */
export function useColors(): ColorTokens {
  return useTheme().colors;
}

/** Returns true when dark mode is active */
export function useIsDark(): boolean {
  return useTheme().isDark;
}
