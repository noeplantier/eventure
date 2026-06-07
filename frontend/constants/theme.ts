export const COLORS = {
  // Fonds
  background: '#020A06',
  bg: '#020A06',
  bgMid: '#051A0E',
  navy: '#0A2218',
  navyMid: '#051A0E',
  
  // Surfaces
  surface: '#0A2218',
  surf: 'rgba(0,217,126,0.05)',
  surfHi: 'rgba(0,217,126,0.10)',
  
  // Borders
  border: 'rgba(0,217,126,0.12)',
  borderLight: 'rgba(0,217,126,0.12)',
  borderHi: 'rgba(0,217,126,0.28)',
  borderGold: 'rgba(245,200,66,0.30)',
  
  // Accents
  primary: '#00D97E',
  success: '#00D97E',
  gold: '#F5C842',
  violet: '#A78BFA',
  
  // Textes
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.35)',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.50)',
  faint: 'rgba(255,255,255,0.18)',
  
  // États
  green: '#00D97E',
  amber: '#F59E0B',
  red: '#EF4444',
} as const;

export const SPACING = {
  screenEdge: 16,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;

export const GENRE_COLORS: Record<string, string> = {
  Action: '#FF6B6B',
  Drama: '#A78BFA',
  Comedy: '#FFD60A',
  Horror: '#EF4444',
  SciFi: '#00D97E',
  Romance: '#FF69B4',
  Thriller: '#F59E0B',
  Animation: '#00D97E',
  Documentary: '#64748B',
  Adventure: '#F59E0B',
};

export const DURATION_LABELS: Record<string, string> = {
  short: 'Court',
  medium: 'Moyen',
  long: 'Long',
};