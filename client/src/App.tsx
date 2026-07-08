import type { Permission } from "@member-manager/shared";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement, useEffect, useState } from "react";
import {
	BrowserRouter,
	Navigate,
	Route,
	Routes,
	useLocation,
} from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { Skeleton } from "./components/ui/skeleton";
import { SkeletonRegion } from "./components/ui/skeleton-blocks";
import { ToastProvider } from "./contexts/ToastContext";
import AdminCertificateRequestsPage from "./features/admin/AdminCertificateRequestsPage";
import AdminChangeRequestsPage from "./features/admin/AdminChangeRequestsPage";
import { AdminDatabaseView } from "./features/admin/AdminDatabaseView";
import AdminJobRequestsPage from "./features/admin/AdminJobRequestsPage";
import { Auth } from "./features/auth/Auth";
import EngagementCertificatePage from "./features/certificate/EngagementCertificatePage";
import ContractBoardSignPage from "./features/contracts/ContractBoardSignPage";
import ContractFormPage from "./features/contracts/ContractFormPage";
import ContractSignPage from "./features/contracts/ContractSignPage";
import ContractSubmissionDetailPage from "./features/contracts/ContractSubmissionDetailPage";
import ContractSubmissionsPage from "./features/contracts/ContractSubmissionsPage";
import ContractTemplatesPage from "./features/contracts/ContractTemplatesPage";
import FinanceTransactionsPage from "./features/finance/FinanceTransactionsPage";
import JobPostingsPage from "./features/jobs/JobPostingsPage";
import { MemberList } from "./features/members/MemberList";
import MembersInnovationPage from "./features/members/MembersInnovationPage";
import MembersOrgChartPage from "./features/members/MembersOrgChartPage";
import MembersOrgTreePage from "./features/members/MembersOrgTreePage";
import MembersResearchPage from "./features/members/MembersResearchPage";
import ProfilePage from "./features/profile/ProfilePage";
import ReimbursementPage from "./features/reimbursements/ReimbursementPage";
import ReimbursementReviewPage from "./features/reimbursements/ReimbursementReviewPage";
import TumaiDaysPage from "./features/tools/TumaiDaysPage";
import { useIsAdmin } from "./hooks/useIsAdmin";
import { useToolAccess } from "./hooks/useToolAccess";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabaseClient";

export default function App(): JSX.Element {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

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

	async function handleLogout(): Promise<void> {
		await supabase.auth.signOut();
		queryClient.clear();
		setUser(null);
	}

	if (loading) {
		return (
			<SkeletonRegion
				label="Loading"
				className="flex min-h-screen items-center justify-center p-6"
			>
				<div className="w-full max-w-sm space-y-4">
					<Skeleton className="mx-auto size-12 rounded-xl" />
					<Skeleton className="mx-auto h-5 w-40" />
					<Skeleton className="h-10 w-full rounded-md" />
				</div>
			</SkeletonRegion>
		);
	}

	return (
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<BrowserRouter>
					<AppRouter user={user} onLogout={handleLogout} />
				</BrowserRouter>
			</ToastProvider>
		</QueryClientProvider>
	);
}

interface AppRouterProps {
	user: User | null;
	onLogout: () => Promise<void>;
}

// The partner-signing page (/contracts/sign/:token) and the board-signing page
// (/contracts/board-sign/:token) are public — render them before the auth gate
// so unauthenticated signers can sign without an account.
function AppRouter({ user, onLogout }: AppRouterProps): JSX.Element {
	const location = useLocation();
	const isPublicSignRoute =
		location.pathname.startsWith("/contracts/sign/") ||
		location.pathname.startsWith("/contracts/board-sign/");

	if (isPublicSignRoute) {
		return (
			<Routes>
				<Route path="/contracts/sign/:token" element={<ContractSignPage />} />
				<Route
					path="/contracts/board-sign/:token"
					element={<ContractBoardSignPage />}
				/>
			</Routes>
		);
	}

	if (!user) {
		return <Auth />;
	}

	return <AuthenticatedApp user={user} onLogout={onLogout} />;
}

interface AuthenticatedAppProps {
	user: User;
	onLogout: () => void;
}

export function AuthenticatedApp({
	user,
	onLogout,
}: AuthenticatedAppProps): JSX.Element {
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);
	const { permissions } = useToolAccess();
	const hasContractsAccess =
		isAdmin ||
		permissions.includes("contracts.admin") ||
		permissions.includes("contracts.create");

	const adminRoute = (element: JSX.Element): JSX.Element =>
		isLoadingAdminRole ? (
			<RouteAccessLoading />
		) : isAdmin ? (
			element
		) : (
			<Navigate to="/" replace />
		);

	return (
		<MainLayout
			user={user}
			isAdmin={isAdmin || isLoadingAdminRole}
			hasContractsAccess={hasContractsAccess}
			onLogout={onLogout}
		>
			<Routes>
				<Route path="/" element={<ProfilePage user={user} />} />
				<Route path="/profile" element={<Navigate to="/" replace />} />
				<Route path="/members" element={<MemberList />} />
				<Route path="/members/org-chart" element={<MembersOrgChartPage />} />
				<Route path="/members/org-tree" element={<MembersOrgTreePage />} />
				<Route path="/members/research" element={<MembersResearchPage />} />
				<Route path="/members/innovation" element={<MembersInnovationPage />} />
				<Route
					path="/members/projects"
					element={<Navigate to="/members/research" replace />}
				/>
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
					path="/tools/finance/buchhaltungsbutler"
					element={
						<RequirePermission permission="finance.review">
							<FinanceTransactionsPage />
						</RequirePermission>
					}
				/>
				<Route
					path="/tools/tumai-days"
					element={
						<RequirePermission permission="tumai_days.manage">
							<TumaiDaysPage />
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
				<Route path="/tools/jobs" element={<JobPostingsPage />} />
				<Route
					path="/contracts"
					element={
						<RequireAnyPermission
							permissions={["contracts.create", "contracts.admin"]}
						>
							<ContractFormPage />
						</RequireAnyPermission>
					}
				/>
				<Route
					path="/contracts/drafts/:draftId"
					element={
						<RequireAnyPermission
							permissions={["contracts.create", "contracts.admin"]}
						>
							<ContractFormPage />
						</RequireAnyPermission>
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
						<RequireAnyPermission
							permissions={["contracts.create", "contracts.admin"]}
						>
							<ContractSubmissionsPage />
						</RequireAnyPermission>
					}
				/>
				<Route
					path="/contracts/submissions/:id"
					element={
						<RequireAnyPermission
							permissions={["contracts.create", "contracts.admin"]}
						>
							<ContractSubmissionDetailPage />
						</RequireAnyPermission>
					}
				/>
				<Route path="/admin" element={adminRoute(<AdminDatabaseView />)} />
				<Route
					path="/admin/change-requests"
					element={adminRoute(<AdminChangeRequestsPage />)}
				/>
				<Route
					path="/admin/certificate-requests"
					element={adminRoute(<AdminCertificateRequestsPage />)}
				/>
				<Route
					path="/admin/job-requests"
					element={adminRoute(<AdminJobRequestsPage />)}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</MainLayout>
	);
}

function RouteAccessLoading(): JSX.Element {
	return (
		<SkeletonRegion label="Checking access" className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-7 w-56" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={i}
						className="space-y-3 rounded-xl border bg-card p-5"
					>
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				))}
			</div>
		</SkeletonRegion>
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

// Same as RequirePermission but allows access if the user has ANY of the listed
// permissions (OR logic). Used when multiple roles share access to a feature.
function RequireAnyPermission({
	permissions: required,
	children,
}: {
	permissions: Permission[];
	children: ReactElement;
}): ReactElement {
	const { permissions, isLoading } = useToolAccess();

	if (isLoading) {
		return <RouteAccessLoading />;
	}

	if (!required.some((p) => permissions.includes(p))) {
		return <Navigate to="/" replace />;
	}

	return children;
}
