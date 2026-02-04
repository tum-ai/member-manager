export const keyframes = {
	fadeIn: {
		"0%": { opacity: 0 },
		"100%": { opacity: 1 },
	},
	slideUp: {
		"0%": { transform: "translateY(20px)", opacity: 0 },
		"100%": { transform: "translateY(0)", opacity: 1 },
	},
	scaleIn: {
		"0%": { transform: "scale(0.95)", opacity: 0 },
		"100%": { transform: "scale(1)", opacity: 1 },
	},
	checkmark: {
		"0%": { strokeDashoffset: 24 },
		"100%": { strokeDashoffset: 0 },
	},
	shimmer: {
		"0%": { backgroundPosition: "-200% 0" },
		"100%": { backgroundPosition: "200% 0" },
	},
	pulse: {
		"0%, 100%": { opacity: 1 },
		"50%": { opacity: 0.5 },
	},
};

export const transitions = {
	fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
	normal: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
	slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
	spring: "400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export const hoverEffects = {
	lift: {
		transition: transitions.normal,
		"&:hover": {
			transform: "translateY(-2px)",
			boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
		},
	},
	glow: {
		transition: transitions.normal,
		"&:hover": {
			boxShadow: "0 0 20px rgba(208, 188, 255, 0.3)",
		},
	},
	scale: {
		transition: transitions.fast,
		"&:hover": {
			transform: "scale(1.02)",
		},
		"&:active": {
			transform: "scale(0.98)",
		},
	},
};

export const glassmorphism = {
	light: {
		background: "rgba(255, 255, 255, 0.05)",
		backdropFilter: "blur(10px)",
		border: "1px solid rgba(255, 255, 255, 0.1)",
	},
	medium: {
		background: "rgba(255, 255, 255, 0.08)",
		backdropFilter: "blur(16px)",
		border: "1px solid rgba(255, 255, 255, 0.15)",
	},
	strong: {
		background: "rgba(255, 255, 255, 0.12)",
		backdropFilter: "blur(24px)",
		border: "1px solid rgba(255, 255, 255, 0.2)",
	},
};
