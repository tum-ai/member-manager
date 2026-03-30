import { zodResolver } from "@hookform/resolvers/zod";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import {
	Box,
	Button,
	CircularProgress,
	Container,
	Divider,
	IconButton,
	Paper,
	TextField,
	Tooltip,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "../../lib/apiClient";
import { supabase } from "../../lib/supabaseClient";
import type { AppColorMode } from "../../theme";

const authSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthSchema = z.infer<typeof authSchema>;

const AuthCard = styled(Paper)(({ theme }) => ({
	padding: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
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
	maxWidth: 480,
	[theme.breakpoints.down("sm")]: {
		padding: theme.spacing(3),
	},
}));

interface UserWithRole extends User {
	role?: string;
}

interface AuthProps {
	colorMode: AppColorMode;
	onLogin: (user: UserWithRole) => void;
	onToggleColorMode: () => void;
}

export default function Auth({
	colorMode,
	onLogin,
	onToggleColorMode,
}: AuthProps) {
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);

	const theme = useTheme();
	const isLargeScreen = useMediaQuery(theme.breakpoints.up("md"));

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<AuthSchema>({
		resolver: zodResolver(authSchema),
	});

	async function handlePostLogin(user: User) {
		try {
			const memberData = await apiClient<{ role?: string }>("/api/members", {
				method: "POST",
				body: JSON.stringify({
					user_id: user.id,
				}),
			});

			const role = memberData?.role || "user";
			onLogin({ ...user, role });
			window.history.replaceState(null, "", "/");
		} catch (err) {
			console.error("Unexpected error in post-login:", err);
			setMessage("Failed to load user profile.");
		}
	}

	async function onSubmit(data: AuthSchema) {
		setMessage("");
		setLoading(true);

		try {
			if (isLogin) {
				const { data: authData, error } =
					await supabase.auth.signInWithPassword({
						email: data.email,
						password: data.password,
					});

				if (error) {
					setMessage(error.message);
					return;
				}

				const user = authData.user || authData.session?.user;
				if (!user) {
					setMessage("Login failed. No user returned.");
					return;
				}

				await handlePostLogin(user);
			} else {
				const { error } = await supabase.auth.signUp({
					email: data.email,
					password: data.password,
					options: {
						emailRedirectTo: `${window.location.origin}/`,
					},
				});

				if (error) {
					setMessage(error.message);
					return;
				}

				setMessage(
					"Registration successful. Please check your email to confirm your address before logging in.",
				);
			}
		} catch (err) {
			console.error("Unexpected error:", err);
			setMessage("An unexpected error occurred.");
		} finally {
			setLoading(false);
		}
	}

	const signInWithSlack = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: "slack_oidc",
			options: {
				redirectTo: import.meta.env.VITE_SLACK_CALLBACK_URL,
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
				flexDirection: isLargeScreen ? "row" : "column",
				justifyContent: "center",
				alignItems: "center",
				minHeight: "100vh",
				px: { xs: 2, md: 4 },
				py: { xs: 4, md: 6 },
				position: "relative",
				overflow: "hidden",
				backgroundColor: theme.palette.background.default,
				gap: theme.spacing(isLargeScreen ? 10 : 4),
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

			<Box
				sx={{
					textAlign: isLargeScreen ? "left" : "center",
					flexShrink: 0,
					maxWidth: 520,
					position: "relative",
					zIndex: 1,
					p: { xs: 3, md: 4 },
					borderRadius: 6,
					backgroundColor:
						theme.palette.mode === "light"
							? theme.palette.secondary.main
							: alpha(theme.palette.background.paper, 0.5),
					border: `1px solid ${alpha("#FFFFFF", theme.palette.mode === "light" ? 0.08 : 0.06)}`,
				}}
			>
				<img
					src="/img/tum_ai_logo_new.svg"
					alt="TUM.ai Logo"
					style={{
						width: isLargeScreen ? "220px" : "168px",
						marginBottom: theme.spacing(3),
					}}
				/>
				<Box
					sx={{
						display: "inline-flex",
						px: 1.5,
						py: 0.75,
						borderRadius: 999,
						backgroundColor: "rgba(255, 255, 255, 0.06)",
						border: "1px solid rgba(255, 255, 255, 0.12)",
						mb: 2,
					}}
				>
					<Typography
						variant="caption"
						sx={{ color: "rgba(255, 255, 255, 0.72)" }}
					>
						Private member workspace
					</Typography>
				</Box>
				<Typography
					variant="h2"
					sx={{
						mb: 2,
						maxWidth: 520,
						fontSize: { xs: "2.2rem", md: "3.25rem" },
						color: "#ffffff",
					}}
				>
					Keep the TUM.ai member network up to date.
				</Typography>
				<Typography
					variant="body1"
					sx={{ maxWidth: 520, mb: 3, color: "rgba(255, 255, 255, 0.78)" }}
				>
					Update your profile, maintain internal membership details, and browse
					the active community from one place.
				</Typography>
				<Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
					{["Profiles", "Directory", "Private data"].map((label) => (
						<Box
							key={label}
							sx={{
								px: 1.5,
								py: 0.75,
								borderRadius: 999,
								backgroundColor: "rgba(255, 255, 255, 0.04)",
								border: "1px solid rgba(255, 255, 255, 0.1)",
							}}
						>
							<Typography
								variant="caption"
								sx={{ color: "rgba(255, 255, 255, 0.72)" }}
							>
								{label}
							</Typography>
						</Box>
					))}
				</Box>
			</Box>

			<AuthCard sx={{ position: "relative", zIndex: 1 }}>
				<Typography variant="h4" component="h2" align="center" gutterBottom>
					{isLogin ? "Sign In" : "Register"}
				</Typography>
				<Typography
					align="center"
					color="text.secondary"
					sx={{ mb: 1, maxWidth: 360, mx: "auto" }}
				>
					Use your member credentials to access your profile and the internal
					community directory.
				</Typography>

				<form onSubmit={handleSubmit(onSubmit)}>
					<Box
						sx={{
							display: "flex",
							flexDirection: "column",
							gap: theme.spacing(2),
						}}
					>
						<TextField
							label="Email"
							type="email"
							{...register("email")}
							error={!!errors.email}
							helperText={errors.email?.message}
							fullWidth
						/>
						<TextField
							label="Password"
							type="password"
							{...register("password")}
							error={!!errors.password}
							helperText={errors.password?.message}
							fullWidth
						/>
						<Button
							type="submit"
							variant="contained"
							color="primary"
							fullWidth
							disabled={loading}
							sx={{ mt: 2, height: 52 }}
						>
							{loading ? (
								<CircularProgress size={24} color="inherit" />
							) : isLogin ? (
								"Login"
							) : (
								"Register"
							)}
						</Button>
					</Box>
				</form>

				<Divider sx={{ borderColor: "divider", my: 1.5 }}>or</Divider>

				<Button
					variant="outlined"
					onClick={signInWithSlack}
					fullWidth
					sx={{ height: 52 }}
				>
					Continue with Slack
				</Button>

				{message && (
					<Typography
						color="error"
						align="center"
						sx={{
							mt: 1,
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

				<Box sx={{ textAlign: "center", mt: 2 }}>
					<Button
						variant="text"
						onClick={() => setIsLogin(!isLogin)}
						sx={{
							color: theme.palette.primary.main,
						}}
					>
						{isLogin
							? "Don't have an account? Sign Up"
							: "Already have an account? Sign In"}
					</Button>
				</Box>
			</AuthCard>
		</Container>
	);
}
