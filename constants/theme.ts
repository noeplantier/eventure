// constants/theme.ts — Design tokens Eventure
export const COLORS = {
  bg:      '#070C17',    // fond principal
  navy:    '#0D2240',    // surfaces
  violet:  '#A78BFA',    // accent principal
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,0.50)',
  faint:   'rgba(255,255,255,0.18)',
  surf:    'rgba(255,255,255,0.05)',
  surfHi:  'rgba(255,255,255,0.09)',
  border:  'rgba(255,255,255,0.08)',
  gold:    '#F5C842',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
} as const;

export const SPACING = {
  xs:  4,  sm:  8,
  md:  16, lg:  24,
  xl:  32, xxl: 48,
} as const;

export const RADIUS = {
  sm:  8,  md: 14,
  lg:  18, xl: 24,
  full: 999,
} as const;
