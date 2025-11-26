import '@mui/material/styles';
import React from 'react';

declare module '@mui/material/styles' {
  interface Palette {
    tertiary: Palette['primary'];
    outline: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary'];
    outline?: string;
    surface?: string;
    onSurface?: string;
    surfaceVariant?: string;
    onSurfaceVariant?: string;
  }
  interface PaletteColor {
    onPrimary?: string;
    onSecondary?: string;
    onTertiary?: string;
    onError?: string;
    default?: string;
    onSurface?: string;
  }
  interface SimplePaletteColorOptions {
    onPrimary?: string;
    onSecondary?: string;
    onTertiary?: string;
    onError?: string;
    default?: string;
    onSurface?: string;
  }
  interface TypographyVariants {
    displayLarge: React.CSSProperties;
    displayMedium: React.CSSProperties;
    displaySmall: React.CSSProperties;
    headlineLarge: React.CSSProperties;
    headlineMedium: React.CSSProperties;
    headlineSmall: React.CSSProperties;
    titleLarge: React.CSSProperties;
    titleMedium: React.CSSProperties;
    titleSmall: React.CSSProperties;
    bodyLarge: React.CSSProperties;
    bodyMedium: React.CSSProperties;
    bodySmall: React.CSSProperties;
    labelLarge: React.CSSProperties;
    labelMedium: React.CSSProperties;
    labelSmall: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    displayLarge?: React.CSSProperties;
    displayMedium?: React.CSSProperties;
    displaySmall?: React.CSSProperties;
    headlineLarge?: React.CSSProperties;
    headlineMedium?: React.CSSProperties;
    headlineSmall?: React.CSSProperties;
    titleLarge?: React.CSSProperties;
    titleMedium?: React.CSSProperties;
    titleSmall?: React.CSSProperties;
    bodyLarge?: React.CSSProperties;
    bodyMedium?: React.CSSProperties;
    bodySmall?: React.CSSProperties;
    labelLarge?: React.CSSProperties;
    labelMedium?: React.CSSProperties;
    labelSmall?: React.CSSProperties;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    tertiary: true;
  }
}
