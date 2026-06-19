// Eventure Design System v3 — Indigo Light Theme
export const COLORS = {
  // Brand — Indigo
  primary:       '#6366F1',
  primaryLight:  '#EEF2FF',
  primaryDark:   '#4338CA',
  primaryGhost:  'rgba(99,102,241,0.08)',
  primaryBorder: 'rgba(99,102,241,0.20)',

  // Secondary — Purple
  secondary:      '#8B5CF6',
  secondaryLight: '#F5F3FF',
  secondaryGhost: 'rgba(139,92,246,0.10)',

  // Semantic
  success:      '#10B981',
  successLight: '#ECFDF5',
  successGhost: 'rgba(16,185,129,0.10)',

  warning:      '#F59E0B',
  warningLight: '#FFFBEB',
  warningGhost: 'rgba(245,158,11,0.10)',

  danger:      '#EF4444',
  dangerLight: '#FEF2F2',
  dangerGhost: 'rgba(239,68,68,0.10)',

  info:      '#3B82F6',
  infoLight: '#EFF6FF',
  infoGhost: 'rgba(59,130,246,0.10)',

  // Surfaces
  background:    '#F8FAFC',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F1F5F9',
  surfaceHover:  '#F8FAFC',

  // Text
  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  // Border
  border:      '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark:  '#D1D5DB',

  // Navigation
  navBg:       '#FFFFFF',
  navActive:   '#6366F1',
  navInactive: '#9CA3AF',

  // Aliases (legacy compat — dark theme pages keep their own local palettes)
  violet: '#8B5CF6',
  green:  '#10B981',
  gold:   '#F59E0B',
  amber:  '#F59E0B',
  red:    '#EF4444',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  white:  '#FFFFFF',
  muted:  '#6B7280',
  faint:  '#9CA3AF',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screenEdge: 16,
} as const;

export const RADIUS = {
  sm:   8,
  md:  12,
  lg:  16,
  xl:  20,
  full: 9999,
} as const;

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  primary: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
