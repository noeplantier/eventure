/**
 * Eventure Design System v4 — "Aura"
 * Dark, futuristic, professional. Replaces Indigo Light across the app.
 * Deep graphite base (not pure black) + indigo/violet/cyan glow accents.
 */
export const AURA = {
  // Surfaces — deep graphite
  bg:           '#0A0C10',
  bgElevated:   '#0D1016',
  surface:      '#141821',
  surfaceAlt:   '#1A1F2A',
  surfaceHover: '#20263280',
  border:       '#242A38',
  borderLight:  '#2E3646',

  // Brand — Indigo (lighter than Indigo Light's primary, pops on dark bg)
  primary:       '#818CF8',
  primaryDeep:   '#6366F1',
  primaryGhost:  'rgba(129,140,248,0.12)',
  primaryBorder: 'rgba(129,140,248,0.30)',
  primaryGlow:   'rgba(129,140,248,0.45)',

  // Secondary — Violet
  secondary:      '#C4B5FD',
  secondaryDeep:  '#8B5CF6',
  secondaryGhost: 'rgba(196,181,253,0.12)',
  secondaryGlow:  'rgba(139,92,246,0.45)',

  // Futuristic duality accent — Cyan
  cyan:      '#22D3EE',
  cyanGhost: 'rgba(34,211,238,0.12)',
  cyanGlow:  'rgba(34,211,238,0.45)',

  // Semantic
  success:      '#34D399',
  successGhost: 'rgba(52,211,153,0.12)',
  successGlow:  'rgba(52,211,153,0.45)',

  warning:      '#FBBF24',
  warningGhost: 'rgba(251,191,36,0.12)',
  warningGlow:  'rgba(251,191,36,0.45)',

  danger:      '#F87171',
  dangerGhost: 'rgba(248,113,113,0.12)',
  dangerGlow:  'rgba(248,113,113,0.45)',

  // Text
  text:       '#F1F5F9',
  textSub:    '#94A3B8',
  textMuted:  '#5B6472',
  textInverse:'#0A0C10',
} as const;

export const AURA_RADIUS = { sm: 10, md: 16, lg: 20, xl: 26, full: 9999 } as const;

export const AURA_SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, screenEdge: 16 } as const;

/** Static elevation shadow (non-interactive) — pair with <Aura> for interactive glow. */
export const auraShadow = (color: string, opacity = 0.25) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: opacity,
  shadowRadius: 16,
  elevation: 8,
});
