import { alpha, Card, type CardProps, styled } from "@mui/material";

interface GlassCardProps extends CardProps {
	variant?: "default" | "elevated" | "interactive";
}

const StyledCard = styled(Card, {
	shouldForwardProp: (prop) => prop !== "variant",
})<GlassCardProps>(({ theme, variant = "default" }) => ({
	background:
		theme.palette.mode === "light"
			? "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 248, 252, 1) 100%)"
			: alpha(theme.palette.background.paper, 0.82),
	backdropFilter: "blur(10px)",
	border: "none",
	borderRadius: 20,
	boxShadow:
		theme.palette.mode === "light"
			? "0 18px 48px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)"
			: "0 18px 42px rgba(6, 4, 14, 0.2)",
	transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",

	...(variant === "elevated" && {
		background:
			theme.palette.mode === "light"
				? "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(250, 248, 252, 1) 100%)"
				: alpha(theme.palette.background.paper, 0.88),
		boxShadow:
			theme.palette.mode === "light"
				? "0 24px 56px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 1)"
				: "0 22px 48px rgba(6, 4, 14, 0.24)",
	}),

	...(variant === "interactive" && {
		cursor: "pointer",
		"&:hover": {
			transform: "translateY(-4px)",
			boxShadow:
				theme.palette.mode === "light"
					? "0 24px 60px rgba(15, 23, 42, 0.14)"
					: "0 24px 54px rgba(6, 4, 14, 0.28)",
		},
		"&:active": {
			transform: "translateY(0)",
		},
	}),
}));

export default function GlassCard({
	children,
	variant = "default",
	...props
}: GlassCardProps) {
	return (
		<StyledCard variant={variant} {...props}>
			{children}
		</StyledCard>
	);
}
