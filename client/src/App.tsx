// Main Application - Simplified routing with ProfilePage
import {
	Box,
	CircularProgress,
	CssBaseline,
	ThemeProvider,
	Typography,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import MainLayout from "./components/layout/MainLayout";
import { ToastProvider } from "./contexts/ToastContext";
import Auth from "./features/auth/Auth";
import ProfilePage from "./features/profile/ProfilePage";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabaseClient";
import getAppTheme from "./theme";

const theme = getAppTheme();

export default function App() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setUser(session?.user ?? null);
			setLoading(false);
		});

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				setUser(session?.user ?? null);
			},
		);

		return () => {
			listener.subscription.unsubscribe();
		};
	}, []);

	async function handleLogout() {
		await supabase.auth.signOut();
		setUser(null);
	}

	if (loading) {
		return (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Box
					sx={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						minHeight: "100vh",
						gap: 2,
					}}
				>
					<CircularProgress />
					<Typography variant="h6" color="text.secondary">
						Loading...
					</Typography>
				</Box>
			</ThemeProvider>
		);
	}

	if (!user) {
		return (
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Auth onLogin={setUser} />
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<MainLayout user={user} onLogout={handleLogout}>
						<ProfilePage user={user} />
					</MainLayout>
				</ToastProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
