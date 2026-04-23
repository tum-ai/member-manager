import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import {
	Box,
	Button,
	Container,
	IconButton,
	Paper,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { useState } from "react";
import { getSlackRedirectUrl } from "../../lib/authRedirect";
import { supabase } from "../../lib/supabaseClient";
import type { AppColorMode } from "../../theme";

const AuthCard = styled(Paper)(({ theme }) => ({
	padding: theme.spacing(5),
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing(3),
	borderRadius: 28,
	background:
		theme.palette.mode === "light"
			? "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 248, 252, 1) 100%)"
			: alpha(theme.palette.background.paper, 0.82),
	border: "none",
	backdropFilter: "blur(12px)",
	boxShadow:
		theme.palette.mode === "light"
			? "0 22px 56px rgba(15, 23, 42, 0.12)"
			: "0 18px 42px rgba(6, 4, 14, 0.2)",
	width: "100%",
	maxWidth: 440,
	[theme.breakpoints.down("sm")]: {
		padding: theme.spacing(4),
	},
}));

interface AuthProps {
	colorMode: AppColorMode;
	onToggleColorMode: () => void;
}

export default function Auth({ colorMode, onToggleColorMode }: AuthProps) {
	const [message, setMessage] = useState("");

	const theme = useTheme();

	const signInWithSlack = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "slack_oidc",
			options: {
				redirectTo: getSlackRedirectUrl({
					currentOrigin:
						typeof window === "undefined" ? undefined : window.location.origin,
					configuredRedirectUrl: import.meta.env.VITE_SLACK_CALLBACK_URL,
				}),
			},
		});

		if (error) {
			console.error("Slack error:", error.message);
			setMessage(`Slack error: ${error.message}`);
			return;
		}
	};

	return (
		<Container
			maxWidth={false}
			sx={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				minHeight: "100vh",
				px: { xs: 2, md: 4 },
				py: { xs: 4, md: 6 },
				position: "relative",
				overflow: "hidden",
				backgroundColor: theme.palette.background.default,
			}}
		>
			<Box
				aria-hidden
				sx={{
					position: "absolute",
					inset: 0,
					background:
						theme.palette.mode === "light"
							? "linear-gradient(to top right, rgba(154, 100, 217, 0.08) 0%, transparent 34%)"
							: "radial-gradient(circle at 88% 16%, rgba(154, 100, 217, 0.16), transparent 18%), radial-gradient(circle at 12% 36%, rgba(96, 165, 250, 0.12), transparent 22%)",
				}}
			/>

			<Tooltip
				title={
					colorMode === "light"
						? "Switch to night mode"
						: "Switch to light mode"
				}
			>
				<IconButton
					onClick={onToggleColorMode}
					sx={{
						position: "absolute",
						top: { xs: 18, md: 28 },
						right: { xs: 18, md: 28 },
						zIndex: 2,
						backgroundColor:
							theme.palette.mode === "light"
								? alpha(theme.palette.background.paper, 0.9)
								: alpha(theme.palette.background.paper, 0.18),
						border: `1px solid ${theme.palette.divider}`,
						color: theme.palette.text.primary,
						"&:hover": {
							backgroundColor:
								theme.palette.mode === "light"
									? theme.palette.background.paper
									: alpha(theme.palette.background.paper, 0.28),
						},
					}}
				>
					{colorMode === "light" ? (
						<DarkModeOutlinedIcon fontSize="small" />
					) : (
						<LightModeOutlinedIcon fontSize="small" />
					)}
				</IconButton>
			</Tooltip>

			<AuthCard sx={{ position: "relative", zIndex: 1 }}>
				<img
					src="/img/tum_ai_logo_new.svg"
					alt="TUM.ai Logo"
					style={{ width: 168 }}
				/>
				<Typography variant="h4" component="h1" align="center">
					Member Manager
				</Typography>
				<Button
					variant="contained"
					color="primary"
					onClick={signInWithSlack}
					fullWidth
					sx={{ height: 52, mt: 1 }}
				>
					Continue with Slack
				</Button>

				{message && (
					<Typography
						color="error"
						align="center"
						sx={{
							px: 2,
							py: 1.5,
							borderRadius: 2.5,
							backgroundColor: "rgba(232, 122, 149, 0.08)",
							border: "1px solid rgba(232, 122, 149, 0.22)",
						}}
					>
						{message}
					</Typography>
				)}
			</AuthCard>
		</Container>
	);
}
