/**
 * Blame Travis — Design Tokens
 * Aesthetic: "Adventure Adventure Card" (Vintage, Tactile, Inviting)
 */

export const palette = {
  // Base Colors
  ink: '#1C1C1E',
  paper: '#F4EFE6',
  white: '#FFFFFF',
  softGray: '#E0DDD5',
  mediumGray: '#9E9C96',
  lightGray: '#D1CEC7',

  // Brand Colors (Ink Stamps)
  vintageRed: '#B71C1C',
  vintageRedDark: '#7F0000',
  vintageRedLight: '#F05545',

  // Status Colors
  success: '#2E7D32',
  warning: '#F9A825',
  error: '#C62828',
  info: '#1565C0',

  // Transparent variants
  overlay: 'rgba(28, 28, 30, 0.6)',
  glass: 'rgba(255, 255, 255, 0.7)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
};

export const roundness = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  full: 9999,
};

export const typography = {
  fonts: {
    bold: 'System',
    medium: 'System',
    regular: 'System',
    mono: 'System',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    display: 48,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },
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
};

export type Theme = typeof theme;
