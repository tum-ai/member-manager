import {
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	Slide,
	Typography,
	useTheme,
} from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";
import type { User } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import AdminDatabaseView from "./features/admin/AdminDatabaseView";
import Auth from "./features/auth/Auth";
import Certificate from "./features/certificate/Certificate";
import PrivacyPolicy from "./features/legal/PrivacyPolicy";
import MemberForm from "./features/members/MemberForm";
import SepaMandate from "./features/sepa/SepaMandate";
import { queryClient } from "./lib/queryClient";
import { supabase } from "./lib/supabaseClient";
import type { PrivacyUpdateEventDetail, SepaUpdateEventDetail } from "./types";

// Transition for Dialog (like a bottom-up slide)
const Transition = React.forwardRef(function Transition(
	props: TransitionProps & {
		// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
		children: React.ReactElement<any, any>;
	},
	ref: React.Ref<unknown>,
) {
	return <Slide direction="up" ref={ref} {...props} />;
});

const dummyUser: User = {
	id: "00000000-0000-0000-0000-000000000001",
	app_metadata: {},
	user_metadata: {},
	aud: "authenticated",
	created_at: new Date().toISOString(),
	email: "debug@example.com",
	role: "user",
} as User;

import { ToastProvider } from "./contexts/ToastContext";

export default function App() {
	const isDev = import.meta.env.MODE === "development" && false;
	const [user, setUser] = useState<User | null>(isDev ? dummyUser : null);
	const [loading, setLoading] = useState(!isDev);
	const [userRole, setUserRole] = useState<string | null>(null);

	const [showSepa, setShowSepa] = useState(false);
	const [showPrivacy, setShowPrivacy] = useState(false);

	const [sepaChecked, setSepaChecked] = useState(false);
	const [privacyChecked, setPrivacyChecked] = useState(false);

	// Get current agreement states from user's data
	const [currentSepaAgreed, setCurrentSepaAgreed] = useState(false);
	const [currentPrivacyAgreed, setCurrentPrivacyAgreed] = useState(false);

	const theme = useTheme();

	useEffect(() => {
		const handleOpenSepa = () => setShowSepa(true);
		const handleOpenPrivacy = () => setShowPrivacy(true);

		window.addEventListener("open-sepa", handleOpenSepa);
		window.addEventListener("open-privacy", handleOpenPrivacy);

		return () => {
			window.removeEventListener("open-sepa", handleOpenSepa);
			window.removeEventListener("open-privacy", handleOpenPrivacy);
		};
	}, []);

	useEffect(() => {
		const handleSepaUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<SepaUpdateEventDetail>;
			if (
				customEvent.detail &&
				typeof customEvent.detail.mandate_agreed === "boolean"
			) {
				setSepaChecked(customEvent.detail.mandate_agreed);
				setCurrentSepaAgreed(customEvent.detail.mandate_agreed);
			}
		};

		const handlePrivacyUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<PrivacyUpdateEventDetail>;
			if (
				customEvent.detail &&
				typeof customEvent.detail.privacy_agreed === "boolean"
			) {
				setPrivacyChecked(customEvent.detail.privacy_agreed);
				setCurrentPrivacyAgreed(customEvent.detail.privacy_agreed);
			}
		};

		window.addEventListener("sepa-updated", handleSepaUpdate);
		window.addEventListener("privacy-updated", handlePrivacyUpdate);

		return () => {
			window.removeEventListener("sepa-updated", handleSepaUpdate);
			window.removeEventListener("privacy-updated", handlePrivacyUpdate);
		};
	}, []);

	useEffect(() => {
		if (!isDev) {
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
		}
	}, []);

	useEffect(() => {
		if (user) {
			supabase
				.from("user_roles")
				.select("role")
				.eq("user_id", user.id)
				.single()
				.then(({ data }) => {
					if (data) setUserRole(data.role);
					else setUserRole(null);
				});
		} else {
			setUserRole(null);
		}
	}, [user]);

	useEffect(() => {
		if (user && !isDev) {
			supabase
				.from("sepa")
				.select("mandate_agreed, privacy_agreed")
				.eq("user_id", user.id)
				.single()
				.then(({ data }) => {
					if (data) {
						setCurrentSepaAgreed(data.mandate_agreed || false);
						setCurrentPrivacyAgreed(data.privacy_agreed || false);
						setSepaChecked(data.mandate_agreed || false);
						setPrivacyChecked(data.privacy_agreed || false);
					}
				});
		}
	}, [user]);

	async function handleLogout() {
		await supabase.auth.signOut();
		setUser(null);
	}

	const handleSepaModalClose = () => {
		setShowSepa(false);
		setCurrentSepaAgreed(sepaChecked);
		window.dispatchEvent(
			new CustomEvent("sepa-updated", {
				detail: { mandate_agreed: sepaChecked },
			}),
		);
	};

	const handlePrivacyModalClose = () => {
		setShowPrivacy(false);
		setCurrentPrivacyAgreed(privacyChecked);
		window.dispatchEvent(
			new CustomEvent("privacy-updated", {
				detail: { privacy_agreed: privacyChecked },
			}),
		);
	};

	if (loading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "100vh",
					backgroundColor: theme.palette.background.default,
				}}
			>
				<CircularProgress />
				<Typography
					variant="h6"
					sx={{ ml: 2, color: theme.palette.text.primary }}
				>
					Loading...
				</Typography>
			</Box>
		);
	}

	if (!user) return <Auth onLogin={setUser} />;

	return (
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<Router>
					<MainLayout
						user={user}
						userRole={userRole}
						onLogout={handleLogout}
						onOpenSepa={() => setShowSepa(true)}
						onOpenPrivacy={() => setShowPrivacy(true)}
					>
						<Routes>
							{userRole === "user" && (
								<>
									<Route path="/" element={<MemberForm user={user} />} />
									<Route
										path="/sepa"
										element={
											<SepaMandate
												onCheckChange={setSepaChecked}
												sepaAgreed={currentSepaAgreed}
											/>
										}
									/>
									<Route
										path="/privacy"
										element={
											<PrivacyPolicy
												onCheckChange={setPrivacyChecked}
												privacyAgreed={currentPrivacyAgreed}
											/>
										}
									/>
									<Route
										path="/certificate"
										element={<Certificate user={user} />}
									/>
								</>
							)}
							{userRole === "admin" && (
								<Route path="/" element={<AdminDatabaseView />} />
							)}
						</Routes>
					</MainLayout>

					{/* SEPA Dialog */}
					<Dialog
						open={showSepa}
						onClose={handleSepaModalClose}
						TransitionComponent={Transition}
						fullWidth
						maxWidth="md"
						PaperProps={{
							sx: {
								borderRadius: (theme.shape.borderRadius as number) * 2,
								backgroundColor: theme.palette.background.paper,
								color: theme.palette.text.primary,
								p: theme.spacing(2),
							},
						}}
					>
						<DialogTitle variant="h5" sx={{ textAlign: "center", pb: 2 }}>
							SEPA Mandate
							<IconButton
								aria-label="close"
								onClick={handleSepaModalClose}
								sx={{
									position: "absolute",
									right: 8,
									top: 8,
									color: (theme) => theme.palette.grey[500],
								}}
							/>
						</DialogTitle>
						<DialogContent dividers>
							<SepaMandate
								onCheckChange={setSepaChecked}
								sepaAgreed={currentSepaAgreed}
							/>
						</DialogContent>
						<DialogActions sx={{ pt: 2, pb: 1, pr: 2 }}>
							<Button
								onClick={handleSepaModalClose}
								color="primary"
								variant="contained"
							>
								Confirm
							</Button>
						</DialogActions>
					</Dialog>

					{/* Privacy Dialog */}
					<Dialog
						open={showPrivacy}
						onClose={handlePrivacyModalClose}
						TransitionComponent={Transition}
						fullWidth
						maxWidth="md"
						PaperProps={{
							sx: {
								borderRadius: (theme.shape.borderRadius as number) * 2,
								backgroundColor: theme.palette.background.paper,
								color: theme.palette.text.primary,
								p: theme.spacing(2),
							},
						}}
					>
						<DialogTitle variant="h5" sx={{ textAlign: "center", pb: 2 }}>
							Privacy Policy
							<IconButton
								aria-label="close"
								onClick={handlePrivacyModalClose}
								sx={{
									position: "absolute",
									right: 8,
									top: 8,
									color: (theme) => theme.palette.grey[500],
								}}
							>
								×
							</IconButton>
						</DialogTitle>
						<DialogContent dividers>
							<PrivacyPolicy
								onCheckChange={setPrivacyChecked}
								privacyAgreed={currentPrivacyAgreed}
							/>
						</DialogContent>
						<DialogActions sx={{ pt: 2, pb: 1, pr: 2 }}>
							<Button
								onClick={handlePrivacyModalClose}
								disabled={!privacyChecked}
								color="primary"
								variant="contained"
							>
								Confirm
							</Button>
						</DialogActions>
					</Dialog>
				</Router>
			</ToastProvider>
		</QueryClientProvider>
	);
}
