import { zodResolver } from "@hookform/resolvers/zod";
import {
	Box,
	Button,
	CircularProgress,
	Container,
	Link,
	Paper,
	TextField,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiClient } from "../../lib/apiClient";
import { supabase } from "../../lib/supabaseClient";

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
	borderRadius: (theme.shape.borderRadius as number) * 2,
	boxShadow: theme.shadows[3],
	width: "100%",
	maxWidth: 400,
	[theme.breakpoints.down("sm")]: {
		padding: theme.spacing(3),
	},
}));

interface UserWithRole extends User {
	role?: string;
}

interface AuthProps {
	onLogin: (user: UserWithRole) => void;
}

export default function Auth({ onLogin }: AuthProps) {
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
				padding: theme.spacing(3),
				backgroundColor: theme.palette.background.default,
				gap: theme.spacing(isLargeScreen ? 8 : 4),
			}}
		>
			<Box
				sx={{
					textAlign: isLargeScreen ? "left" : "center",
					flexShrink: 0,
				}}
			>
				<img
					src="/img/logo.webp"
					alt="TUM.ai Logo"
					style={{
						width: isLargeScreen ? "180px" : "120px",
						marginBottom: theme.spacing(isLargeScreen ? 0 : 4),
					}}
				/>
				{isLargeScreen && (
					<Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>
						Welcome to TUM.ai Portal
					</Typography>
				)}
			</Box>

			<AuthCard>
				<Typography variant="h5" component="h2" align="center" gutterBottom>
					{isLogin ? "Sign In" : "Register"}
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
							sx={{ mt: 2, height: 48 }}
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

				<Box sx={{ display: "flex", alignItems: "center", my: 2 }}>
					<Box sx={{ flex: 1, borderTop: 1, borderColor: "divider" }} />
					<Typography sx={{ px: 2, color: "text.secondary" }}>or</Typography>
					<Box sx={{ flex: 1, borderTop: 1, borderColor: "divider" }} />
				</Box>

				<div style={{ textAlign: "center" }}>
					<button
						type="button"
						onClick={signInWithSlack}
						style={{
							background: "none",
							border: "none",
							padding: 0,
							cursor: "pointer",
						}}
					>
						<img
							src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
							srcSet="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack.png 2x"
							alt="Sign in with Slack"
						/>
					</button>
				</div>

				{message && (
					<Typography color="error" align="center" sx={{ mt: 2 }}>
						{message}
					</Typography>
				)}
				<Box sx={{ textAlign: "center", mt: 2 }}>
					<Link
						component="button"
						variant="body2"
						onClick={() => setIsLogin(!isLogin)}
						sx={{
							textDecoration: "none",
							"&:hover": {
								textDecoration: "underline",
							},
							color: theme.palette.primary.main,
						}}
					>
						{isLogin
							? "Don't have an account? Sign Up"
							: "Already have an account? Sign In"}
					</Link>
				</Box>
			</AuthCard>
		</Container>
	);
}
