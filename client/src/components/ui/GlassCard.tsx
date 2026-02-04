import { Card, type CardProps, styled } from "@mui/material";

interface GlassCardProps extends CardProps {
	variant?: "default" | "elevated" | "interactive";
}

const StyledCard = styled(Card, {
	shouldForwardProp: (prop) => prop !== "variant",
})<GlassCardProps>(({ theme, variant = "default" }) => ({
	backgroundColor: "rgba(30, 30, 30, 0.7)",
	backdropFilter: "blur(16px)",
	border: `1px solid ${theme.palette.divider}`,
	borderRadius: 16,
	transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",

	...(variant === "elevated" && {
		backgroundColor: "rgba(37, 37, 37, 0.8)",
		boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
	}),

	...(variant === "interactive" && {
		cursor: "pointer",
		"&:hover": {
			transform: "translateY(-2px)",
			borderColor: "rgba(208, 188, 255, 0.4)",
			boxShadow: "0 12px 40px rgba(0, 0, 0, 0.3)",
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
