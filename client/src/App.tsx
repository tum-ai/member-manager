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
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import { ToastProvider } from "./contexts/ToastContext";
import Auth from "./features/auth/Auth";
import EngagementCertificatePage from "./features/certificate/EngagementCertificatePage";
import MemberList from "./features/members/MemberList";
import ProfilePage from "./features/profile/ProfilePage";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabaseClient";
import getAppTheme from "./theme";

const theme = getAppTheme();

export default function App(): JSX.Element {
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

	async function handleLogout(): Promise<void> {
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
					<BrowserRouter>
						<MainLayout user={user} onLogout={handleLogout}>
							<Routes>
								<Route path="/" element={<ProfilePage user={user} />} />
								<Route path="/profile" element={<Navigate to="/" replace />} />
								<Route path="/members" element={<MemberList />} />
								<Route
									path="/engagement-certificate"
									element={<EngagementCertificatePage user={user} />}
								/>
								<Route path="*" element={<Navigate to="/" replace />} />
							</Routes>
						</MainLayout>
					</BrowserRouter>
				</ToastProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
