/**
 * Blame Travis — Design Tokens
 * Aesthetic: "Adventure Adventure Card" (Vintage, Tactile, Inviting)
 */

export const palette = {
  // Base Colors - Editorial Nomad (Luxury & Minimalist)
  ink: '#1A1A1A',
  paper: '#F9F9FB', // Very light gray backdrop
  white: '#FFFFFF',
  softGray: '#F2F2F5',
  mediumGray: '#999999',
  lightGray: '#E5E5E5',

  // Brand Colors - Editorial Nomad (Classic Black)
  vintageRed: '#1A1A1A',
  vintageRedDark: '#000000',
  vintageRedLight: '#444444',

  // Status Colors
  success: '#2E7D32',
  warning: '#F9A825',
  error: '#C62828',
  info: '#1565C0',

  // Transparent variants
  overlay: 'rgba(255, 255, 255, 0.9)',
  glass: 'rgba(255, 255, 255, 0.7)',
  inkGlow: 'rgba(26, 26, 26, 0.05)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  huge: 80,
};

export const roundness = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  fonts: {
    narrative: 'Inter_300Light',
    narrativeMedium: 'Inter_400Regular',
    narrativeBold: 'Inter_600SemiBold',
    technical: 'Inter_400Regular',
    technicalMedium: 'Inter_600SemiBold',
    technicalBold: 'Inter_700Bold',
    bold: 'Inter_700Bold',
    black: 'Inter_900Black',
    medium: 'Inter_500Medium',
    regular: 'Inter_400Regular',
    light: 'Inter_300Light',
    mono: 'System',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
    display: 56,
  },
  lineHeights: {
    tight: 1.1,
    normal: 1.5,
    loose: 1.8,
  },
};

export const shadows = {
  card: {
    distance: 20,
    startColor: 'rgba(0, 0, 0, 0.03)',
    endColor: 'rgba(0, 0, 0, 0)',
    offset: [0, 10] as [number, number],
  },
  float: {
    distance: 40,
    startColor: 'rgba(0, 0, 0, 0.06)',
    endColor: 'rgba(0, 0, 0, 0)',
    offset: [0, 20] as [number, number],
  },
  pressed: {
    distance: 4,
    startColor: 'rgba(0, 0, 0, 0.1)',
    endColor: 'rgba(0, 0, 0, 0)',
    offset: [0, 2] as [number, number],
  }
};

export const theme = {
  colors: {
    background: palette.paper,
    surface: palette.white,
    surfaceElevated: palette.softGray,
    primary: palette.vintageRed,
    textPrimary: palette.ink,
    textSecondary: palette.mediumGray,
    textInverted: palette.paper,
    border: palette.lightGray,
    accent: palette.vintageRed,
    error: palette.error,
    success: palette.success,
    warning: palette.warning,
    lightGray: palette.lightGray,
    mediumGray: palette.mediumGray,
  },
  spacing,
  roundness,
  typography,
  shadows,
};

export type Theme = typeof theme;
