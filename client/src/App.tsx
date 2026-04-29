import {
	Box,
	CircularProgress,
	CssBaseline,
	ThemeProvider,
	Typography,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import { ToastProvider } from "./contexts/ToastContext";
import AdminDatabaseView from "./features/admin/AdminDatabaseView";
import Auth from "./features/auth/Auth";
import EngagementCertificatePage from "./features/certificate/EngagementCertificatePage";
import MemberList from "./features/members/MemberList";
import ProfilePage from "./features/profile/ProfilePage";
import ReimbursementPage from "./features/reimbursements/ReimbursementPage";
import ReimbursementReviewPage from "./features/reimbursements/ReimbursementReviewPage";
import ToolsPage from "./features/tools/ToolsPage";
import { useIsAdmin } from "./hooks/useIsAdmin";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabaseClient";
import {
	type AppColorMode,
	COLOR_MODE_STORAGE_KEY,
	default as getAppTheme,
	getPreferredColorMode,
} from "./theme";

export default function App(): JSX.Element {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [colorMode, setColorMode] = useState<AppColorMode>(() =>
		getPreferredColorMode(),
	);
	const theme = useMemo(() => getAppTheme(colorMode), [colorMode]);

	useEffect(() => {
		// Don't let a slow or unreachable auth service freeze the UI:
		// if getSession() hasn't resolved within 5s (e.g. Supabase URL is
		// down or DNS-failing), assume no session and render the login screen.
		const AUTH_BOOTSTRAP_TIMEOUT_MS = 5_000;
		let cancelled = false;

		const timeoutId = window.setTimeout(() => {
			if (cancelled) return;
			console.warn(
				"supabase.auth.getSession() timed out; rendering login screen.",
			);
			setUser(null);
			setLoading(false);
		}, AUTH_BOOTSTRAP_TIMEOUT_MS);

		supabase.auth
			.getSession()
			.then(({ data: { session } }) => {
				if (cancelled) return;
				setUser(session?.user ?? null);
				setLoading(false);
			})
			.catch((error) => {
				if (cancelled) return;
				console.error("Failed to load auth session:", error);
				setUser(null);
				setLoading(false);
			})
			.finally(() => {
				window.clearTimeout(timeoutId);
			});

		const { data: listener } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				setUser(session?.user ?? null);
			},
		);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
			listener.subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
	}, [colorMode]);

	async function handleLogout(): Promise<void> {
		await supabase.auth.signOut();
		setUser(null);
	}

	function toggleColorMode(): void {
		setColorMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
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
				<Auth colorMode={colorMode} onToggleColorMode={toggleColorMode} />
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<BrowserRouter>
						<AuthenticatedApp
							user={user}
							colorMode={colorMode}
							onLogout={handleLogout}
							onToggleColorMode={toggleColorMode}
						/>
					</BrowserRouter>
				</ToastProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}

interface AuthenticatedAppProps {
	user: User;
	colorMode: AppColorMode;
	onLogout: () => void;
	onToggleColorMode: () => void;
}

function AuthenticatedApp({
	user,
	colorMode,
	onLogout,
	onToggleColorMode,
}: AuthenticatedAppProps): JSX.Element {
	const { isAdmin } = useIsAdmin(user.id);

	return (
		<MainLayout
			user={user}
			isAdmin={isAdmin}
			onLogout={onLogout}
			colorMode={colorMode}
			onToggleColorMode={onToggleColorMode}
		>
			<Routes>
				<Route path="/" element={<ProfilePage user={user} />} />
				<Route path="/profile" element={<Navigate to="/" replace />} />
				<Route path="/members" element={<MemberList />} />
				<Route path="/tools" element={<ToolsPage user={user} />} />
				<Route
					path="/tools/reimbursement"
					element={<ReimbursementPage user={user} />}
				/>
				<Route
					path="/tools/reimbursement/review"
					element={<ReimbursementReviewPage />}
				/>
				<Route
					path="/engagement-certificate"
					element={<EngagementCertificatePage user={user} />}
				/>
				<Route
					path="/tools/engagement-certificate"
					element={<EngagementCertificatePage user={user} />}
				/>
				<Route
					path="/admin"
					element={
						isAdmin ? <AdminDatabaseView /> : <Navigate to="/" replace />
					}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</MainLayout>
	);
}
