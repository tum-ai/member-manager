import {
	alpha,
	createTheme,
	type PaletteMode,
	type ThemeOptions,
} from "@mui/material/styles";

export type AppColorMode = PaletteMode;

export const COLOR_MODE_STORAGE_KEY = "member-manager-color-mode";

export function getPreferredColorMode(): AppColorMode {
	if (typeof window === "undefined") {
		return "light";
	}

	const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
	if (storedMode === "light" || storedMode === "dark") {
		return storedMode;
	}

	return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
		? "dark"
		: "light";
}

const typography: ThemeOptions["typography"] = {
	fontFamily: "'Manrope', 'Inter', 'Roboto', sans-serif",
	h1: { fontSize: "3.1rem", fontWeight: 800, letterSpacing: "-0.04em" },
	h2: { fontSize: "2.45rem", fontWeight: 700, letterSpacing: "-0.03em" },
	h3: { fontSize: "1.85rem", fontWeight: 700, letterSpacing: "-0.025em" },
	h4: { fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-0.02em" },
	h5: { fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.01em" },
	h6: { fontSize: "1rem", fontWeight: 700 },
	body1: { fontSize: "1rem", lineHeight: 1.6 },
	body2: { fontSize: "0.875rem", lineHeight: 1.5 },
	button: { fontSize: "0.95rem", fontWeight: 700, textTransform: "none" },
	caption: { fontSize: "0.75rem", lineHeight: 1.4 },
};

const paletteByMode = {
	light: {
		primary: "#9A64D9",
		primaryDark: "#523573",
		secondary: "#111827",
		surfaceDefault: "#FAF8F2",
		surfacePaper: "#FFFFFF",
		surfaceMuted: "#F4F0E8",
		textPrimary: "#171923",
		textSecondary: "#5E6472",
		textDisabled: "#9AA1AE",
		divider: "rgba(23, 25, 35, 0.1)",
		appBar: "rgba(15, 23, 42, 0.92)",
		success: "#3FA27B",
		error: "#D95D79",
		warning: "#E5A64B",
	},
	dark: {
		primary: "#9A64D9",
		primaryDark: "#523573",
		secondary: "#E5E7EB",
		surfaceDefault: "#0D0214",
		surfacePaper: "#18112F",
		surfaceMuted: "#241B3A",
		textPrimary: "#F5F7FB",
		textSecondary: "#D0C3E3",
		textDisabled: "#8875A4",
		divider: "rgba(154, 100, 217, 0.2)",
		appBar: "rgba(13, 2, 20, 0.88)",
		success: "#58C89A",
		error: "#F08AA1",
		warning: "#F0C26C",
	},
} as const;

const getAppTheme = (mode: AppColorMode = "light") => {
	const colors = paletteByMode[mode];

	return createTheme({
		palette: {
			mode,
			primary: {
				main: colors.primary,
				dark: colors.primaryDark,
				contrastText: "#FFFFFF",
			},
			secondary: {
				main: colors.secondary,
			},
			error: { main: colors.error },
			success: { main: colors.success },
			warning: { main: colors.warning },
			background: {
				default: colors.surfaceDefault,
				paper: colors.surfacePaper,
			},
			text: {
				primary: colors.textPrimary,
				secondary: colors.textSecondary,
				disabled: colors.textDisabled,
			},
			divider: colors.divider,
		},
		typography,
		shape: { borderRadius: 12 },
		components: {
			MuiCssBaseline: {
				styleOverrides: {
					":root": {
						colorScheme: mode,
					},
					body: {
						backgroundColor: colors.surfaceDefault,
						backgroundImage:
							mode === "light"
								? "radial-gradient(circle at top left, rgba(154, 100, 217, 0.09), transparent 28%), linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(250, 248, 242, 0.95))"
								: "radial-gradient(circle at 88% 16%, rgba(154, 100, 217, 0.16), transparent 18%), radial-gradient(circle at 12% 36%, rgba(96, 165, 250, 0.12), transparent 22%), radial-gradient(circle at 78% 82%, rgba(129, 140, 248, 0.12), transparent 20%), linear-gradient(135deg, #0d0214 0%, #140625 46%, #1b0049 76%, #523573 100%)",
						backgroundAttachment: "fixed",
						color: colors.textPrimary,
						transition:
							"background-color 180ms ease, background-image 180ms ease, color 180ms ease",
					},
					"#root": {
						minHeight: "100vh",
					},
				},
			},
			MuiButton: {
				defaultProps: { disableElevation: true },
				styleOverrides: {
					root: {
						borderRadius: 12,
						padding: "12px 24px",
						transition: "all 220ms cubic-bezier(0.4, 0, 0.2, 1)",
						fontWeight: 700,
					},
					contained: {
						backgroundColor: colors.primary,
						color: "#FFFFFF",
						boxShadow:
							mode === "light"
								? `0 14px 32px ${alpha(colors.primary, 0.16)}`
								: `0 14px 32px ${alpha(colors.primary, 0.24)}`,
						"&:hover": {
							backgroundColor: colors.primaryDark,
							transform: "translateY(-1px)",
							boxShadow:
								mode === "light"
									? `0 18px 38px ${alpha(colors.primary, 0.22)}`
									: `0 18px 38px ${alpha(colors.primary, 0.34)}`,
						},
						"&:active": { transform: "translateY(0)" },
					},
					outlined: {
						borderColor: alpha(colors.primary, 0.3),
						color: colors.primary,
						backgroundColor: "transparent",
						"&:hover": {
							borderColor: alpha(colors.primary, 0.45),
							backgroundColor: alpha(colors.primary, 0.07),
						},
					},
					text: {
						color: colors.primary,
					},
				},
			},
			MuiTextField: {
				defaultProps: { variant: "outlined", fullWidth: true },
				styleOverrides: {
					root: {
						"& .MuiOutlinedInput-root": {
							borderRadius: 12,
							backgroundColor:
								mode === "light"
									? alpha(colors.surfacePaper, 0.96)
									: alpha(colors.surfacePaper, 0.78),
							transition: "all 200ms ease",
							"&:hover": {
								backgroundColor:
									mode === "light"
										? colors.surfacePaper
										: alpha(colors.surfacePaper, 0.9),
							},
							"&.Mui-focused": {
								backgroundColor:
									mode === "light"
										? colors.surfacePaper
										: alpha(colors.surfacePaper, 0.96),
								boxShadow: `0 0 0 4px ${alpha(colors.primary, 0.14)}`,
								"& .MuiOutlinedInput-notchedOutline": {
									borderColor: colors.primary,
									borderWidth: 2,
								},
							},
						},
						"& .MuiOutlinedInput-notchedOutline": {
							borderColor: colors.divider,
						},
						"& .MuiInputLabel-root": {
							color: colors.textSecondary,
						},
						"& .MuiOutlinedInput-input": {
							color: colors.textPrimary,
						},
						"& .MuiFormHelperText-root": {
							marginLeft: 0,
						},
					},
				},
			},
			MuiSelect: {
				styleOverrides: {
					icon: {
						color: colors.textSecondary,
					},
				},
			},
			MuiCard: {
				styleOverrides: {
					root: {
						backgroundColor:
							mode === "light"
								? alpha(colors.surfacePaper, 0.96)
								: alpha(colors.surfacePaper, 0.84),
						border: "none",
						boxShadow:
							mode === "light"
								? "0 18px 48px rgba(15, 23, 42, 0.08)"
								: "0 18px 42px rgba(6, 4, 14, 0.2)",
						borderRadius: 20,
						transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
					},
				},
			},
			MuiPaper: {
				styleOverrides: {
					root: {
						backgroundImage: "none",
						backgroundColor: colors.surfacePaper,
					},
				},
			},
			MuiDialog: {
				styleOverrides: {
					paper: {
						borderRadius: 24,
						backgroundColor:
							mode === "light"
								? alpha(colors.surfacePaper, 0.98)
								: alpha(colors.surfacePaper, 0.96),
						backdropFilter: "blur(20px)",
						border: "none",
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
						backgroundColor: colors.appBar,
						backdropFilter: "blur(18px)",
						borderBottom: `1px solid ${alpha("#FFFFFF", mode === "light" ? 0.12 : 0.1)}`,
					},
				},
			},
			MuiCheckbox: {
				styleOverrides: {
					root: {
						color: colors.textDisabled,
						"&.Mui-checked": {
							color: colors.primary,
						},
					},
				},
			},
			MuiChip: {
				styleOverrides: {
					outlined: {
						borderColor: colors.divider,
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
		},
	});
};

export default getAppTheme;
