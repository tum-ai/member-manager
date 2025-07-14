// src/theme.js
import { createTheme } from '@mui/material/styles';

// Define all M3 Typography Variants as constants FIRST
// This way, they can be referenced consistently throughout the theme object
const displayLarge = {
    fontSize: '5.75rem', // 92px
    lineHeight: '6.5rem', // 104px
    fontWeight: 400,
};

const displayMedium = {
    fontSize: '4.5rem', // 72px
    lineHeight: '5.25rem', // 84px
    fontWeight: 400,
};

const displaySmall = {
    fontSize: '3.5rem', // 57px
    lineHeight: '4rem', // 64px
    fontWeight: 400,
};

const headlineLarge = {
    fontSize: '2.25rem', // 36px
    lineHeight: '2.75rem', // 44px
    fontWeight: 400,
};

const headlineMedium = {
    fontSize: '2rem', // 32px
    lineHeight: '2.5rem', // 40px
    fontWeight: 400,
};

const headlineSmall = {
    fontSize: '1.75rem', // 28px
    lineHeight: '2.25rem', // 36px
    fontWeight: 400,
};

const titleLarge = {
    fontSize: '1.375rem', // 22px
    lineHeight: '1.75rem', // 28px
    fontWeight: 400,
};

const titleMedium = {
    fontSize: '1rem', // 16px
    lineHeight: '1.5rem', // 24px
    fontWeight: 500,
};

const titleSmall = {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem', // 20px
    fontWeight: 500,
};

const bodyLarge = {
    fontSize: '1rem', // 16px
    lineHeight: '1.5rem', // 24px
    fontWeight: 400,
};

const bodyMedium = {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem', // 20px
    fontWeight: 400,
};

const bodySmall = {
    fontSize: '0.75rem', // 12px
    lineHeight: '1rem', // 16px
    fontWeight: 400,
};

const labelLarge = {
    fontSize: '0.875rem', // 14px
    lineHeight: '1.25rem', // 20px
    fontWeight: 500,
};

const labelMedium = {
    fontSize: '0.75rem', // 12px
    lineHeight: '1rem', // 16px
    fontWeight: 500,
};

const labelSmall = {
    fontSize: '0.6875rem', // 11px
    lineHeight: '1rem', // 16px
    fontWeight: 500,
};

// Main theme creation function for dark mode
const getAppTheme = () =>
  createTheme({
    palette: {
      mode: 'dark', // Explicitly set to 'dark' for your application
      primary: {
        main: '#D0BCFF', // M3 primary color for dark theme (e.g., from Material Theme Builder)
        onPrimary: '#321D59', // Text/icon color that contrasts well with primary.main
      },
      secondary: {
        main: '#CCC2DC', // M3 secondary color for dark theme
        onSecondary: '#3C2E4D', // Text/icon color that contrasts well with secondary.main
      },
      tertiary: {
        main: '#EFB8C8', // M3 tertiary color for dark theme
        onTertiary: '#492532', // Text/icon color that contrasts well with tertiary.main
      },
      error: {
        main: '#CF6679', // M3 error color for dark theme
        onError: '#690005', // Text/icon color that contrasts well with error.main
      },
      background: {
        default: '#1C1B1F', // M3 dark theme surface background
        paper: '#1C1B1F',   // M3 dark theme surface for cards, dialogs, etc.
      },
      text: {
        primary: '#E6E1E5', // M3 dark theme on-surface for primary text
        secondary: '#CAC4D0', // M3 dark theme on-surface-variant for secondary text
      },
      outline: '#8D8C91', // M3 dark theme outline color
      surface: '#1C1B1F', // General surface color
      onSurface: '#E6E1E5', // Text/icon color on general surface
      surfaceVariant: '#49454F', // A variant of the surface color
      onSurfaceVariant: '#CAC4D0', // Text/icon color on surfaceVariant
    },
    typography: {
      fontFamily: 'Roboto, sans-serif', // Material Design default font

      // M3 Typography Scale defined using the constants
      displayLarge,
      displayMedium,
      displaySmall,
      headlineLarge,
      headlineMedium,
      headlineSmall,
      titleLarge,
      titleMedium,
      titleSmall,
      bodyLarge,
      bodyMedium,
      bodySmall,
      labelLarge,
      labelMedium,
      labelSmall,

      // Map standard MUI typography names to M3 using the constants
      h1: displayLarge,
      h2: displayMedium,
      h3: headlineLarge,
      h4: headlineMedium,
      h5: titleLarge,
      h6: titleMedium,
      subtitle1: bodyLarge, // Typically mapped to body large/medium in M3
      subtitle2: bodyMedium,
      body1: bodyLarge,
      body2: bodyMedium,
      button: labelLarge, // M3 uses label for button text
      caption: bodySmall,
      overline: labelSmall,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20, // M3-inspired rounded corners
            textTransform: 'none', // M3 buttons often use Sentence Case
          },
          contained: ({ ownerState, theme }) => ({
            boxShadow: 'none', // M3 tends to have less pronounced shadows
            '&:hover': {
              boxShadow: 'none', // Keep consistent on hover
            },
            // Ensure text color on primary contained buttons contrasts well with the background
            ...(ownerState.color === 'primary' && {
              color: theme.palette.primary.onPrimary,
            }),
            // Add similar for other colors if you use contained secondary/tertiary buttons
            ...(ownerState.color === 'secondary' && {
              color: theme.palette.secondary.onSecondary,
            }),
            ...(ownerState.color === 'tertiary' && {
                color: theme.palette.tertiary.onTertiary,
            }),
            ...(ownerState.color === 'error' && {
                color: theme.palette.error.onError,
            }),
          }),
          text: ({ ownerState, theme }) => ({
            textTransform: 'none',
            ...(ownerState.color === 'primary' && {
                color: theme.palette.primary.main, // Text buttons usually use the main color
            }),
          }),
          outlined: ({ ownerState, theme }) => ({
            textTransform: 'none',
            borderColor: theme.palette.outline, // Use outline color for borders
            ...(ownerState.color === 'primary' && {
                color: theme.palette.primary.main,
            }),
          }),
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined', // Default to outlined for a cleaner M3 look
        },
        styleOverrides: {
          root: ({ ownerState, theme }) => ({
            '& .MuiOutlinedInput-root': {
              borderRadius: '8px', // Slightly rounded corners for text fields
              backgroundColor: 'rgba(255,255,255,0.05)', // Lighter fill for M3 dark mode
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary, // Label color
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.outline, // Use M3 outline color
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.primary.main, // Hover border color
            },
            '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.primary.main, // Focused border color
              borderWidth: '2px', // M3 has a thicker focus outline
            },
            '& .MuiInputBase-input': {
              color: theme.palette.text.primary, // Input text color
            },
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper, // Use theme paper background
            boxShadow: theme.shadows[1], // Lighter shadow for M3 (you might adjust this based on specific M3 guidelines for dark mode elevation)
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.primary.default, // Or a surface-container color for AppBar
            color: theme.palette.primary.onSurface, // Text/icon color on the AppBar should be onPrimary
            boxShadow: 'none', // M3 app bars often have no shadow initially
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            // Default icon buttons within primary colored AppBar should use onPrimary
            color: theme.palette.primary.onPrimary,
          }),
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: '16px', // M3 FABs are square with rounded corners
          },
        },
      },
      MuiDialog: {
          styleOverrides: {
              paper: ({ theme }) => ({
                  borderRadius: theme.shape.borderRadius * 2, // Apply the border radius set in App.jsx's PaperProps here as a default
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
              }),
          },
      },
      MuiDialogTitle: {
          styleOverrides: {
              root: ({ theme }) => ({
                  color: theme.palette.text.primary,
                  paddingBottom: theme.spacing(2),
                  textAlign: 'center', // Center title as in your original modal
              }),
          },
      },
      MuiDialogContent: {
          styleOverrides: {
              root: ({ theme }) => ({
                  color: theme.palette.text.primary,
              }),
          },
      },
      MuiDialogActions: {
          styleOverrides: {
              root: ({ theme }) => ({
                  paddingTop: theme.spacing(2),
                  paddingBottom: theme.spacing(1),
                  paddingRight: theme.spacing(2),
                  justifyContent: 'flex-end', // Align buttons to the right
              }),
          },
      },
    },
  });

export default getAppTheme;