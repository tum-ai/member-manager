// Import MUI components and hooks
import {
	Box,
	Button,
	CircularProgress,
	Container, // For overall page container
	Link, // For the toggle text
	Paper,
	TextField,
	Typography,
	useMediaQuery, // To check screen size for responsiveness
	useTheme, // To access the current theme
} from "@mui/material";
import { styled } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import type React from "react";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

import { apiClient } from "../../lib/apiClient";

// Styled component for the main form card
const AuthCard = styled(Paper)(({ theme }) => ({
	padding: theme.spacing(4),
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing(2),
	borderRadius: (theme.shape.borderRadius as number) * 2, // More rounded for M3
	boxShadow: theme.shadows[3],
	width: "100%",
	maxWidth: 400,
	[theme.breakpoints.down("sm")]: {
		padding: theme.spacing(3), // Slightly less padding on small screens
	},
}));

interface UserWithRole extends User {
	role?: string;
}

interface AuthProps {
	onLogin: (user: UserWithRole) => void;
}

export default function Auth({ onLogin }: AuthProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false); // New loading state for auth actions

	const theme = useTheme();
	const isLargeScreen = useMediaQuery(theme.breakpoints.up("md")); // Check if screen is medium size or larger

	// Create or check member after login
	async function handlePostLogin(user: User) {
		try {
			const memberData = await apiClient<{ role?: string }>("/api/members", {
				method: "POST",
				body: JSON.stringify({
					user_id: user.id,
					email: user.email,
				}),
			});

			const role = memberData?.role || "user";
			onLogin({ ...user, role });
		} catch (err) {
			console.error("Unexpected error in post-login:", err);
			setMessage("Failed to load user profile.");
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setMessage("");
		setLoading(true); // Start loading

		try {
			if (isLogin) {
				const { data, error } = await supabase.auth.signInWithPassword({
					email,
					password,
				});

				if (error) {
					setMessage(error.message);
					return;
				}

				const user = data.user || data.session?.user;
				if (!user) {
					setMessage("Login failed. No user returned.");
					return;
				}

				await handlePostLogin(user);
			} else {
				const { error } = await supabase.auth.signUp({
					email,
					password,
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
			setLoading(false); // Stop loading regardless of outcome
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
			setMessage("Slack error: " + error.message);
			return;
		}
	};


	return (
		<Container
			maxWidth={false} // Allow container to take full width
			sx={{
				display: "flex",
				flexDirection: isLargeScreen ? "row" : "column", // Row for large, column for small
				justifyContent: "center",
				alignItems: "center",
				minHeight: "100vh", // Take full viewport height
				padding: theme.spacing(3), // Use theme spacing
				backgroundColor: theme.palette.background.default, // Use theme background color
				gap: theme.spacing(isLargeScreen ? 8 : 4), // More gap on large screens
			}}
		>
			{/* Logo Section */}
			<Box
				sx={{
					textAlign: isLargeScreen ? "left" : "center",
					flexShrink: 0, // Prevent shrinking
				}}
			>
				<img
					src="/img/logo.webp" // Ensure this path is correct relative to /public
					alt="TUM.ai Logo"
					style={{
						width: isLargeScreen ? "180px" : "120px", // Larger logo on large screens
						marginBottom: theme.spacing(isLargeScreen ? 0 : 4),
					}}
				/>
				{/* Optional: Add a tagline or description for the logo section on larger screens */}
				{isLargeScreen && (
					<Typography variant="h5" color="text.secondary" sx={{ mt: 2 }}>
						Welcome to TUM.ai Portal
					</Typography>
				)}
			</Box>

			{/* Auth Form Card */}
			<AuthCard>
				{" "}
				{/* Use the styled Paper component */}
				<Typography variant="h5" component="h2" align="center" gutterBottom>
					{isLogin ? "Sign In" : "Register"}
				</Typography>
				<form onSubmit={handleSubmit}>
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
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							fullWidth
						/>
						<TextField
							label="Password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							fullWidth
						/>
						<Button
							type="submit"
							variant="contained"
							color="primary"
							fullWidth
							disabled={loading} // Disable button when loading
							sx={{ mt: 2, height: 48 }} // Ensure consistent button height
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

				{/* Divider */}
				<Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
					<Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
					<Typography sx={{ px: 2, color: 'text.secondary' }}>or</Typography>
					<Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
				</Box>

				{/* Slack Sign In */}
				<div style={{ textAlign: "center"}}>
					<img
						src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
						srcSet="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack.png 2x"
						alt="Sign in with Slack"
						style={{ cursor: "pointer" }}
						onClick={signInWithSlack}
					/>
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
							textDecoration: "none", // Remove underline initially
							"&:hover": {
								textDecoration: "underline", // Add underline on hover
							},
							color: theme.palette.primary.main, // Use primary color for the link
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
