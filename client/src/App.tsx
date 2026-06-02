import type { Permission } from "@member-manager/shared";
import {
	Box,
	CircularProgress,
	CssBaseline,
	ThemeProvider,
	Typography,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useLocation,
} from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import { ToastProvider } from "./contexts/ToastContext";
import AdminDatabaseView from "./features/admin/AdminDatabaseView";
import Auth from "./features/auth/Auth";
import EngagementCertificatePage from "./features/certificate/EngagementCertificatePage";
import ContractFormPage from "./features/contracts/ContractFormPage";
import ContractSignPage from "./features/contracts/ContractSignPage";
import ContractSubmissionDetailPage from "./features/contracts/ContractSubmissionDetailPage";
import ContractSubmissionsPage from "./features/contracts/ContractSubmissionsPage";
import ContractTemplatesPage from "./features/contracts/ContractTemplatesPage";
import MemberList from "./features/members/MemberList";
import ProfilePage from "./features/profile/ProfilePage";
import ReimbursementPage from "./features/reimbursements/ReimbursementPage";
import ReimbursementReviewPage from "./features/reimbursements/ReimbursementReviewPage";
import ToolsPage from "./features/tools/ToolsPage";
import { useIsAdmin } from "./hooks/useIsAdmin";
import { useToolAccess } from "./hooks/useToolAccess";
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
				if (!session) {
					queryClient.clear();
				}
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
		queryClient.clear();
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

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<QueryClientProvider client={queryClient}>
				<ToastProvider>
					<BrowserRouter>
						<AppRouter
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

interface AppRouterProps {
	user: User | null;
	colorMode: AppColorMode;
	onLogout: () => Promise<void>;
	onToggleColorMode: () => void;
}

// The partner-signing page (/contracts/sign/:token) is public — render it
// before the auth gate so unauthenticated partners can sign without an
// account.
function AppRouter({
	user,
	colorMode,
	onLogout,
	onToggleColorMode,
}: AppRouterProps): JSX.Element {
	const location = useLocation();
	const isPublicSignRoute = location.pathname.startsWith("/contracts/sign/");

	if (isPublicSignRoute) {
		return (
			<Routes>
				<Route path="/contracts/sign/:token" element={<ContractSignPage />} />
			</Routes>
		);
	}

	if (!user) {
		return <Auth colorMode={colorMode} onToggleColorMode={onToggleColorMode} />;
	}

	return (
		<AuthenticatedApp
			user={user}
			colorMode={colorMode}
			onLogout={onLogout}
			onToggleColorMode={onToggleColorMode}
		/>
	);
}

interface AuthenticatedAppProps {
	user: User;
	colorMode: AppColorMode;
	onLogout: () => void;
	onToggleColorMode: () => void;
}

export function AuthenticatedApp({
	user,
	colorMode,
	onLogout,
	onToggleColorMode,
}: AuthenticatedAppProps): JSX.Element {
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);

	return (
		<MainLayout
			user={user}
			isAdmin={isAdmin || isLoadingAdminRole}
			onLogout={onLogout}
			colorMode={colorMode}
			onToggleColorMode={onToggleColorMode}
		>
			<Routes>
				<Route path="/" element={<ProfilePage user={user} />} />
				<Route path="/profile" element={<Navigate to="/" replace />} />
				<Route path="/members" element={<MemberList />} />
				<Route path="/tools" element={<ToolsPage />} />
				<Route
					path="/tools/reimbursement"
					element={<ReimbursementPage user={user} />}
				/>
				<Route
					path="/tools/reimbursement/review"
					element={
						<RequirePermission permission="finance.review">
							<ReimbursementReviewPage />
						</RequirePermission>
					}
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
					path="/contracts"
					element={
						<RequirePermission permission="contracts.admin">
							<ContractFormPage />
						</RequirePermission>
					}
				/>
				<Route
					path="/contracts/templates"
					element={
						<RequirePermission permission="contracts.admin">
							<ContractTemplatesPage />
						</RequirePermission>
					}
				/>
				<Route
					path="/contracts/submissions"
					element={
						<RequirePermission permission="contracts.admin">
							<ContractSubmissionsPage />
						</RequirePermission>
					}
				/>
				<Route
					path="/contracts/submissions/:id"
					element={
						<RequirePermission permission="contracts.admin">
							<ContractSubmissionDetailPage />
						</RequirePermission>
					}
				/>
				<Route
					path="/admin"
					element={
						isLoadingAdminRole ? (
							<RouteAccessLoading />
						) : isAdmin ? (
							<AdminDatabaseView />
						) : (
							<Navigate to="/" replace />
						)
					}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</MainLayout>
	);
}

function RouteAccessLoading(): JSX.Element {
	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 1.5,
				minHeight: 280,
			}}
		>
			<CircularProgress size={24} />
			<Typography color="text.secondary">Checking access...</Typography>
		</Box>
	);
}

// Client-side route guard that mirrors the server's permission checks: a user
// who navigates directly to a gated route without the required permission is
// redirected home instead of being shown an empty shell that only errors once
// its API calls 403. Admins inherit every permission, so they pass through.
function RequirePermission({
	permission,
	children,
}: {
	permission: Permission;
	children: ReactElement;
}): ReactElement {
	const { permissions, isLoading } = useToolAccess();

	if (isLoading) {
		return <RouteAccessLoading />;
	}

	if (!permissions.includes(permission)) {
		return <Navigate to="/" replace />;
	}

	return children;
}
