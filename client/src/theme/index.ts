// Enhanced MUI Theme with modern design system
import { createTheme, type ThemeOptions } from "@mui/material/styles";

// Color palette - refined for premium dark mode
const colors = {
	primary: {
		main: "#D0BCFF",
		light: "#E8DEFF",
		dark: "#9A82DB",
		onPrimary: "#381E72",
	},
	secondary: {
		main: "#CCC2DC",
		light: "#E8DEF8",
		dark: "#9A8BA7",
		onSecondary: "#332D41",
	},
	accent: {
		gradient: "linear-gradient(135deg, #D0BCFF 0%, #E8DEFF 50%, #CCC2DC 100%)",
		glow: "rgba(208, 188, 255, 0.4)",
	},
	surface: {
		default: "#121212",
		paper: "#1E1E1E",
		elevated: "#252525",
		overlay: "rgba(30, 30, 30, 0.95)",
	},
	text: {
		primary: "#E6E1E5",
		secondary: "#CAC4D0",
		disabled: "#6C6C6C",
	},
	success: "#4CAF50",
	error: "#CF6679",
	warning: "#FFB74D",
	outline: "#49454F",
};

// Typography scale with Inter font
const typography: ThemeOptions["typography"] = {
	fontFamily: "'Inter', 'Roboto', sans-serif",
	h1: { fontSize: "2.5rem", fontWeight: 600, letterSpacing: "-0.02em" },
	h2: { fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.01em" },
	h3: { fontSize: "1.5rem", fontWeight: 600 },
	h4: { fontSize: "1.25rem", fontWeight: 500 },
	h5: { fontSize: "1.125rem", fontWeight: 500 },
	h6: { fontSize: "1rem", fontWeight: 500 },
	body1: { fontSize: "1rem", lineHeight: 1.6 },
	body2: { fontSize: "0.875rem", lineHeight: 1.5 },
	button: { fontSize: "0.875rem", fontWeight: 500, textTransform: "none" },
	caption: { fontSize: "0.75rem", lineHeight: 1.4 },
};

const getAppTheme = () =>
	createTheme({
		palette: {
			mode: "dark",
			primary: {
				main: colors.primary.main,
				light: colors.primary.light,
				dark: colors.primary.dark,
				contrastText: colors.primary.onPrimary,
			},
			secondary: {
				main: colors.secondary.main,
				light: colors.secondary.light,
				dark: colors.secondary.dark,
				contrastText: colors.secondary.onSecondary,
			},
			error: { main: colors.error },
			success: { main: colors.success },
			warning: { main: colors.warning },
			background: {
				default: colors.surface.default,
				paper: colors.surface.paper,
			},
			text: {
				primary: colors.text.primary,
				secondary: colors.text.secondary,
				disabled: colors.text.disabled,
			},
			divider: colors.outline,
		},
		typography,
		shape: { borderRadius: 12 },
		components: {
			MuiCssBaseline: {
				styleOverrides: {
					body: {
						backgroundColor: colors.surface.default,
						backgroundImage:
							"radial-gradient(ellipse at top left, rgba(208, 188, 255, 0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(204, 194, 220, 0.06) 0%, transparent 50%)",
						backgroundAttachment: "fixed",
					},
				},
			},
			MuiButton: {
				defaultProps: { disableElevation: true },
				styleOverrides: {
					root: {
						borderRadius: 10,
						padding: "10px 24px",
						transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
					},
					contained: {
						background: colors.accent.gradient,
						color: colors.primary.onPrimary,
						"&:hover": {
							background: colors.accent.gradient,
							filter: "brightness(1.1)",
							transform: "translateY(-1px)",
							boxShadow: `0 4px 20px ${colors.accent.glow}`,
						},
						"&:active": { transform: "translateY(0)" },
					},
					outlined: {
						borderColor: colors.outline,
						"&:hover": {
							borderColor: colors.primary.main,
							backgroundColor: "rgba(208, 188, 255, 0.08)",
						},
					},
				},
			},
			MuiTextField: {
				defaultProps: { variant: "outlined", fullWidth: true },
				styleOverrides: {
					root: {
						"& .MuiOutlinedInput-root": {
							borderRadius: 10,
							backgroundColor: "rgba(255, 255, 255, 0.03)",
							transition: "all 200ms ease",
							"&:hover": {
								backgroundColor: "rgba(255, 255, 255, 0.05)",
							},
							"&.Mui-focused": {
								backgroundColor: "rgba(255, 255, 255, 0.05)",
								"& .MuiOutlinedInput-notchedOutline": {
									borderColor: colors.primary.main,
									borderWidth: 2,
								},
							},
						},
						"& .MuiOutlinedInput-notchedOutline": {
							borderColor: colors.outline,
						},
						"& .MuiInputLabel-root": {
							color: colors.text.secondary,
						},
					},
				},
			},
			MuiCard: {
				styleOverrides: {
					root: {
						backgroundColor: colors.surface.paper,
						backgroundImage:
							"linear-gradient(rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0))",
						border: `1px solid ${colors.outline}`,
						borderRadius: 16,
						transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
						"&:hover": {
							borderColor: "rgba(208, 188, 255, 0.3)",
							boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
						},
					},
				},
			},
			MuiPaper: {
				styleOverrides: {
					root: {
						backgroundImage: "none",
						backgroundColor: colors.surface.paper,
					},
					elevation1: { boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)" },
					elevation2: { boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)" },
					elevation3: { boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)" },
				},
			},
			MuiDialog: {
				styleOverrides: {
					paper: {
						borderRadius: 20,
						backgroundColor: colors.surface.overlay,
						backdropFilter: "blur(20px)",
						border: `1px solid ${colors.outline}`,
					},
				},
			},
			MuiDialogTitle: {
				styleOverrides: {
					root: {
						fontSize: "1.25rem",
						fontWeight: 600,
						padding: "24px 24px 16px",
					},
				},
			},
			MuiDialogContent: {
				styleOverrides: {
					root: { padding: "16px 24px" },
				},
			},
			MuiDialogActions: {
				styleOverrides: {
					root: { padding: "16px 24px 24px" },
				},
			},
			MuiAppBar: {
				styleOverrides: {
					root: {
						backgroundColor: "rgba(18, 18, 18, 0.8)",
						backdropFilter: "blur(10px)",
						borderBottom: `1px solid ${colors.outline}`,
					},
				},
			},
			MuiCheckbox: {
				styleOverrides: {
					root: {
						color: colors.outline,
						"&.Mui-checked": {
							color: colors.primary.main,
						},
					},
				},
			},
			MuiFormControlLabel: {
				styleOverrides: {
					root: {
						marginLeft: 0,
						marginRight: 0,
					},
				},
			},
			MuiChip: {
				styleOverrides: {
					root: {
						borderRadius: 8,
						fontWeight: 500,
					},
					filled: {
						backgroundColor: "rgba(208, 188, 255, 0.15)",
						color: colors.primary.main,
					},
				},
			},
			MuiIconButton: {
				styleOverrides: {
					root: {
						transition: "all 200ms ease",
						"&:hover": {
							backgroundColor: "rgba(208, 188, 255, 0.1)",
						},
					},
				},
			},
		},
	});

export default getAppTheme;
