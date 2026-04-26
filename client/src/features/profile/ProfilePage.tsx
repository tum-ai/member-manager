import { zodResolver } from "@hookform/resolvers/zod";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
	Box,
	Button,
	CardContent,
	Checkbox,
	Chip,
	CircularProgress,
	FormControlLabel,
	Grid,
	MenuItem,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useMemberChangeRequests } from "../../hooks/useMemberChangeRequests";
import { useMemberData } from "../../hooks/useMemberData";
import { useSepaData } from "../../hooks/useSepaData";
import {
	BATCH_OPTIONS,
	DEGREE_PROGRAM_CUSTOM_OPTION,
	DEGREE_PROGRAM_PRESETS,
	DEGREE_TYPES,
	DEPARTMENTS,
	getCurrentBatch,
	MEMBER_ROLES,
	SCHOOL_CUSTOM_OPTION,
	SCHOOL_PRESETS,
} from "../../lib/constants";
import {
	getMemberStatusLabel,
	joinDegree,
	resolveDepartmentForMemberRole,
	splitDegree,
} from "../../lib/memberMetadata";
import { downloadPdfBlob } from "../../lib/pdfUtils";
import {
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "../../lib/schemas";
import { generateMembershipProofPdf } from "../certificate/generators/membershipProofPdf";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import SepaMandate from "../sepa/SepaMandate";
import { buildSelfServiceMemberUpdatePayload } from "./profileFormUtils";

interface ProfilePageProps {
	user: User;
}

function extractSlackProfile(user: User): {
	given_name: string;
	surname: string;
} {
	const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
	const getString = (key: string): string => {
		const value = metadata[key];
		return typeof value === "string" ? value.trim() : "";
	};

	let given = getString("given_name") || getString("first_name");
	let family = getString("family_name") || getString("last_name");

	if (!given || !family) {
		const fullName = getString("name") || getString("full_name");
		if (fullName) {
			const parts = fullName.split(/\s+/);
			if (!given) given = parts[0] ?? "";
			if (!family && parts.length > 1) family = parts.slice(1).join(" ");
		}
	}

	return { given_name: given, surname: family };
}

export default function ProfilePage({ user }: ProfilePageProps): JSX.Element {
	const theme = useTheme();
	const { showToast } = useToast();
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const [requestedDepartment, setRequestedDepartment] = useState("");
	const [requestedRole, setRequestedRole] = useState("");
	const [changeRequestReason, setChangeRequestReason] = useState("");

	const normalizeTextValue = (value?: string | null): string | null => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	};

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);
	const {
		requests: memberChangeRequests,
		submitChangeRequestAsync,
		isSubmitting: isSubmittingChangeRequest,
	} = useMemberChangeRequests(user.id);

	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(user.id);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			member_status: "active",
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "Germany",
			user_id: user.id,
			batch: "",
			department: "",
			member_role: "",
			degree: "",
			school: "",
		},
	});

	const sepaForm = useForm<SepaSchema>({
		resolver: zodResolver(sepaSchema),
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			user_id: user.id,
		},
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const isActive = memberForm.watch("active");

	useEffect(() => {
		if (isLoadingMember) return;

		const slackProfile = extractSlackProfile(user);
		const slackBatch = getCurrentBatch();
		const existing = memberData ?? {};

		memberForm.reset({
			active: existing.active ?? true,
			member_status:
				existing.member_status || (existing.active ? "active" : "inactive"),
			salutation: existing.salutation || "",
			title: existing.title || "",
			surname: existing.surname || slackProfile.surname,
			given_name: existing.given_name || slackProfile.given_name,
			date_of_birth: existing.date_of_birth || "",
			street: existing.street || "",
			number: existing.number || "",
			postal_code: existing.postal_code || "",
			city: existing.city || "",
			country: existing.country || "Germany",
			user_id: user.id,
			batch: existing.batch || slackBatch,
			department: existing.department || "",
			member_role: existing.member_role || "",
			degree: existing.degree || "",
			school: existing.school || "",
		});
	}, [memberData, isLoadingMember, memberForm, user]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async (): Promise<void> => {
		try {
			const memberValid = await memberForm.trigger();
			const sepaValid = await sepaForm.trigger();

			const promises: Promise<unknown>[] = [];
			if (memberValid) {
				const memberValues = memberForm.getValues();
				const memberPayload = {
					...buildSelfServiceMemberUpdatePayload(memberValues, {
						includeAdminManagedFields: isAdmin,
					}),
					batch: normalizeTextValue(memberValues.batch),
					degree: normalizeTextValue(memberValues.degree),
					school: normalizeTextValue(memberValues.school),
				};
				if (isAdmin) {
					const normalizedRole = normalizeTextValue(memberValues.member_role);
					Object.assign(memberPayload, {
						member_role: normalizedRole || "Member",
						department: resolveDepartmentForMemberRole(
							normalizedRole || "Member",
							normalizeTextValue(memberValues.department),
						),
					});
				}
				promises.push(updateMemberAsync(memberPayload));
			}
			if (sepaValid) {
				promises.push(updateSepaAsync(sepaForm.getValues()));
			}

			await Promise.all(promises);
			showToast("Profile saved successfully!", "success");
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving: ${errorMessage}`, "error");
		}
	};

	const handleDownloadMembershipProof = async (): Promise<void> => {
		if (!memberData || isGeneratingPdf) return;

		setIsGeneratingPdf(true);
		try {
			const pdfBlob = await generateMembershipProofPdf(memberData);
			const safeGivenName = memberData.given_name.replace(
				/[^a-zA-Z0-9-_]/g,
				"-",
			);
			const safeSurname = memberData.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Membership_Proof_${fullName}.pdf`);
			showToast("Membership proof downloaded!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to generate PDF: ${errorMessage}`, "error");
		} finally {
			setIsGeneratingPdf(false);
		}
	};

	const isLoading = isLoadingMember || isLoadingSepa || isLoadingAdminRole;
	const isUpdating = isUpdatingMember || isUpdatingSepa;
	const latestMemberChangeRequest = memberChangeRequests[0];

	const handleSubmitMemberChangeRequest = async (): Promise<void> => {
		const department = resolveDepartmentForMemberRole(
			requestedRole,
			normalizeTextValue(requestedDepartment),
		);
		const memberRole = normalizeTextValue(requestedRole);
		const reason = changeRequestReason.trim();

		if (!department && !memberRole) {
			showToast(
				"Select at least one admin-managed field to request.",
				"warning",
			);
			return;
		}

		try {
			await submitChangeRequestAsync({
				changes: {
					department,
					member_role: memberRole,
				},
				reason: reason || undefined,
			});
			setRequestedDepartment("");
			setRequestedRole("");
			setChangeRequestReason("");
			showToast("Change request sent to the admin team.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to submit change request: ${errorMessage}`, "error");
		}
	};

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "60vh",
					gap: 2,
				}}
			>
				<CircularProgress size={24} />
				<Typography color="text.secondary">Loading profile...</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 2 }}>
			<GlassCard variant="elevated" sx={{ mb: 4, overflow: "hidden" }}>
				<CardContent sx={{ p: { xs: 3, md: 4 } }}>
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: { xs: "flex-start", md: "center" },
							flexDirection: { xs: "column", md: "row" },
							gap: 3,
						}}
					>
						<Box sx={{ maxWidth: 620 }}>
							<Typography variant="h3" sx={{ mb: 1.25 }}>
								Your Profile
							</Typography>
							<Typography variant="body1" color="text.secondary">
								Manage your personal information and internal agreements.
							</Typography>
							<Box
								sx={{
									display: "flex",
									flexWrap: "wrap",
									gap: 1,
									mt: 2.5,
								}}
							>
								<Chip
									icon={
										isActive ? (
											<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
										) : (
											<ErrorOutlineIcon sx={{ fontSize: 18 }} />
										)
									}
									label={`${getMemberStatusLabel(memberForm.watch("member_status"))} Member`}
									color={isActive ? "success" : "default"}
									variant="outlined"
								/>
							</Box>
						</Box>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: {
									xs: "1fr",
									sm: "repeat(2, minmax(0, 1fr))",
								},
								gap: 1.5,
								width: { xs: "100%", md: "auto" },
								minWidth: { md: 360 },
							}}
						>
							<Box
								sx={{
									display: "grid",
									gap: 0.75,
								}}
							>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ px: 0.5 }}
								>
									Department
								</Typography>
								<Box
									sx={{
										p: 2.25,
										minHeight: 88,
										borderRadius: 3,
										backgroundColor:
											theme.palette.mode === "light"
												? "rgba(154, 100, 217, 0.06)"
												: "rgba(24, 17, 47, 0.72)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										textAlign: "center",
									}}
								>
									<Typography sx={{ fontWeight: 700 }}>
										{memberForm.watch("department") || "Not set"}
									</Typography>
								</Box>
							</Box>
							<Box
								sx={{
									display: "grid",
									gap: 0.75,
								}}
							>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{ px: 0.5 }}
								>
									TUM.ai role
								</Typography>
								<Box
									sx={{
										p: 2.25,
										minHeight: 88,
										borderRadius: 3,
										backgroundColor:
											theme.palette.mode === "light"
												? "rgba(154, 100, 217, 0.06)"
												: "rgba(24, 17, 47, 0.72)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										textAlign: "center",
									}}
								>
									<Typography sx={{ fontWeight: 700 }}>
										{memberForm.watch("member_role") || "Member"}
									</Typography>
								</Box>
							</Box>
							<Button
								component={Link}
								to="/engagement-certificate"
								variant="outlined"
								startIcon={<DescriptionIcon />}
								sx={{ minHeight: 52 }}
							>
								Engagement Certificate
							</Button>
							<Button
								variant="outlined"
								startIcon={
									isGeneratingPdf ? (
										<CircularProgress size={16} color="inherit" />
									) : (
										<DownloadIcon />
									)
								}
								onClick={handleDownloadMembershipProof}
								disabled={isGeneratingPdf || !memberData}
								sx={{ minHeight: 52 }}
							>
								{isGeneratingPdf ? "Generating..." : "Proof of Membership"}
							</Button>
						</Box>
					</Box>
				</CardContent>
			</GlassCard>

			<form onSubmit={memberForm.handleSubmit(onSubmit)}>
				<Grid container spacing={3}>
					<Grid size={{ xs: 12, lg: 7 }}>
						<GlassCard variant="elevated">
							<CardContent sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
									Personal Information
								</Typography>

								<Grid container spacing={2}>
									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											select
											label="Salutation (optional)"
											{...memberForm.register("salutation")}
											value={memberForm.watch("salutation") || ""}
											error={!!memberForm.formState.errors.salutation}
											helperText={
												memberForm.formState.errors.salutation?.message
											}
										>
											<MenuItem value="">None</MenuItem>
											<MenuItem value="Mr.">Mr.</MenuItem>
											<MenuItem value="Ms.">Ms.</MenuItem>
											<MenuItem value="Mx.">Mx.</MenuItem>
										</TextField>
									</Grid>
									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											select
											label="Title"
											{...memberForm.register("title")}
											value={memberForm.watch("title")}
										>
											<MenuItem value="">None</MenuItem>
											<MenuItem value="Dr.">Dr.</MenuItem>
											<MenuItem value="Prof.">Prof.</MenuItem>
										</TextField>
									</Grid>

									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											label="First Name"
											{...memberForm.register("given_name")}
											error={!!memberForm.formState.errors.given_name}
											helperText={
												memberForm.formState.errors.given_name?.message
											}
											required
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											label="Last Name"
											{...memberForm.register("surname")}
											error={!!memberForm.formState.errors.surname}
											helperText={memberForm.formState.errors.surname?.message}
											required
										/>
									</Grid>

									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											label="Email"
											type="email"
											value={memberData?.email || user.email || ""}
											helperText="Managed by your account login"
											disabled
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											label="Date of Birth"
											type="date"
											{...memberForm.register("date_of_birth")}
											slotProps={{ inputLabel: { shrink: true } }}
											error={!!memberForm.formState.errors.date_of_birth}
											helperText={
												memberForm.formState.errors.date_of_birth?.message
											}
										/>
									</Grid>

									<Grid size={12}>
										<Typography
											variant="subtitle2"
											color="text.secondary"
											sx={{ mt: 1, mb: 1 }}
										>
											Address
										</Typography>
									</Grid>

									<Grid size={{ xs: 12, sm: 9 }}>
										<TextField
											label="Street"
											{...memberForm.register("street")}
											error={!!memberForm.formState.errors.street}
											helperText={memberForm.formState.errors.street?.message}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 3 }}>
										<TextField
											label="Number"
											{...memberForm.register("number")}
											error={!!memberForm.formState.errors.number}
											helperText={memberForm.formState.errors.number?.message}
										/>
									</Grid>

									<Grid size={{ xs: 12, sm: 4 }}>
										<TextField
											label="Postal Code"
											{...memberForm.register("postal_code")}
											error={!!memberForm.formState.errors.postal_code}
											helperText={
												memberForm.formState.errors.postal_code?.message
											}
										/>
									</Grid>
									<Grid size={{ xs: 12, sm: 8 }}>
										<TextField
											label="City"
											{...memberForm.register("city")}
											error={!!memberForm.formState.errors.city}
											helperText={memberForm.formState.errors.city?.message}
										/>
									</Grid>

									<Grid size={12}>
										<TextField
											label="Country"
											{...memberForm.register("country")}
											error={!!memberForm.formState.errors.country}
											helperText={memberForm.formState.errors.country?.message}
										/>
									</Grid>
								</Grid>
							</CardContent>
						</GlassCard>

						<GlassCard variant="elevated" sx={{ mt: 3 }}>
							<CardContent sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
									TUM.ai Profile
								</Typography>

								<Grid container spacing={2}>
									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											select
											label="Batch"
											{...memberForm.register("batch")}
											value={memberForm.watch("batch") || ""}
											error={!!memberForm.formState.errors.batch}
											helperText={
												memberForm.formState.errors.batch?.message ||
												"Choose your starting semester."
											}
										>
											<MenuItem value="">None</MenuItem>
											{BATCH_OPTIONS.map((batch) => (
												<MenuItem key={batch} value={batch}>
													{batch}
												</MenuItem>
											))}
										</TextField>
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										{isAdmin ? (
											<TextField
												select
												label="Department"
												value={memberForm.watch("department") || ""}
												onChange={(event) =>
													memberForm.setValue(
														"department",
														event.target.value,
														{
															shouldDirty: true,
														},
													)
												}
												helperText="You can edit this directly because you are an admin."
											>
												<MenuItem value="">None</MenuItem>
												{DEPARTMENTS.map((department) => (
													<MenuItem key={department} value={department}>
														{department}
													</MenuItem>
												))}
											</TextField>
										) : (
											<TextField
												label="Department"
												value={memberForm.watch("department") || ""}
												helperText="Departments are managed by admins"
												disabled
											/>
										)}
									</Grid>

									<Grid size={{ xs: 12, sm: 6 }}>
										{isAdmin ? (
											<TextField
												select
												label="Role in TUM.ai"
												value={memberForm.watch("member_role") || "Member"}
												onChange={(event) => {
													const nextRole = event.target.value;
													memberForm.setValue("member_role", nextRole, {
														shouldDirty: true,
													});
												}}
												helperText="You can edit this directly because you are an admin."
											>
												{MEMBER_ROLES.map((role) => (
													<MenuItem key={role} value={role}>
														{role}
													</MenuItem>
												))}
											</TextField>
										) : (
											<TextField
												label="Role in TUM.ai"
												value={memberForm.watch("member_role") || "Member"}
												helperText="Roles are assigned by admins"
												disabled
											/>
										)}
									</Grid>
									<Grid size={{ xs: 12, sm: 6 }}>
										{(() => {
											const storedDegree = memberForm.watch("degree") || "";
											const { type, program } = splitDegree(storedDegree);
											return (
												<TextField
													select
													label="Degree"
													value={type}
													onChange={(e) => {
														memberForm.setValue(
															"degree",
															joinDegree(e.target.value, program),
															{ shouldDirty: true },
														);
													}}
												>
													<MenuItem value="">None</MenuItem>
													{DEGREE_TYPES.map((t) => (
														<MenuItem key={t} value={t}>
															{t}
														</MenuItem>
													))}
												</TextField>
											);
										})()}
									</Grid>
									<Grid size={12}>
										{(() => {
											const storedDegree = memberForm.watch("degree") || "";
											const { type, program } = splitDegree(storedDegree);
											const isPresetProgram =
												program === "" ||
												(DEGREE_PROGRAM_PRESETS as readonly string[]).includes(
													program,
												);
											const selectedProgramOption = isPresetProgram
												? program
												: DEGREE_PROGRAM_CUSTOM_OPTION;
											return (
												<>
													<TextField
														select
														label="Program"
														value={selectedProgramOption}
														onChange={(e) => {
															const chosen = e.target.value;
															if (chosen === DEGREE_PROGRAM_CUSTOM_OPTION) {
																memberForm.setValue(
																	"degree",
																	joinDegree(type, ""),
																	{ shouldDirty: true },
																);
															} else {
																memberForm.setValue(
																	"degree",
																	joinDegree(type, chosen),
																	{ shouldDirty: true },
																);
															}
														}}
														sx={{ mb: isPresetProgram ? 0 : 2 }}
													>
														<MenuItem value="">None</MenuItem>
														{DEGREE_PROGRAM_PRESETS.map((p) => (
															<MenuItem key={p} value={p}>
																{p}
															</MenuItem>
														))}
														<MenuItem value={DEGREE_PROGRAM_CUSTOM_OPTION}>
															Other (custom)
														</MenuItem>
													</TextField>
													{!isPresetProgram && (
														<TextField
															label="Custom program name"
															value={program}
															onChange={(e) =>
																memberForm.setValue(
																	"degree",
																	joinDegree(type, e.target.value),
																	{ shouldDirty: true },
																)
															}
														/>
													)}
												</>
											);
										})()}
									</Grid>

									<Grid size={12}>
										{(() => {
											const storedSchool = memberForm.watch("school") || "";
											const isPresetSchool = (
												SCHOOL_PRESETS as readonly string[]
											).includes(storedSchool);
											const selectedSchoolOption =
												storedSchool === ""
													? ""
													: isPresetSchool
														? storedSchool
														: SCHOOL_CUSTOM_OPTION;
											return (
												<>
													<TextField
														select
														label="School / University"
														value={selectedSchoolOption}
														onChange={(e) => {
															const chosen = e.target.value;
															if (chosen === SCHOOL_CUSTOM_OPTION) {
																memberForm.setValue("school", "", {
																	shouldDirty: true,
																});
															} else {
																memberForm.setValue("school", chosen, {
																	shouldDirty: true,
																});
															}
														}}
														sx={{
															mb:
																selectedSchoolOption === SCHOOL_CUSTOM_OPTION
																	? 2
																	: 0,
														}}
													>
														<MenuItem value="">None</MenuItem>
														{SCHOOL_PRESETS.map((s) => (
															<MenuItem key={s} value={s}>
																{s}
															</MenuItem>
														))}
														<MenuItem value={SCHOOL_CUSTOM_OPTION}>
															Other (custom)
														</MenuItem>
													</TextField>
													{selectedSchoolOption === SCHOOL_CUSTOM_OPTION && (
														<TextField
															label="Custom school / university"
															value={storedSchool}
															onChange={(e) =>
																memberForm.setValue("school", e.target.value, {
																	shouldDirty: true,
																})
															}
														/>
													)}
												</>
											);
										})()}
									</Grid>
								</Grid>
							</CardContent>
						</GlassCard>

						{!isAdmin && (
							<GlassCard variant="elevated" sx={{ mt: 3 }}>
								<CardContent sx={{ p: 3 }}>
									<Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
										Request Admin Changes
									</Typography>
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ mb: 3 }}
									>
										Role and department changes are handled by admins. Submit a
										request here if your internal assignment needs an update.
									</Typography>

									<Grid container spacing={2}>
										<Grid size={{ xs: 12, sm: 6 }}>
											<TextField
												select
												label="Requested department"
												value={requestedDepartment}
												onChange={(event) =>
													setRequestedDepartment(event.target.value)
												}
											>
												<MenuItem value="">No change</MenuItem>
												{DEPARTMENTS.map((department) => (
													<MenuItem key={department} value={department}>
														{department}
													</MenuItem>
												))}
											</TextField>
										</Grid>
										<Grid size={{ xs: 12, sm: 6 }}>
											<TextField
												select
												label="Requested role"
												value={requestedRole}
												onChange={(event) => {
													const nextRole = event.target.value;
													setRequestedRole(nextRole);
												}}
											>
												<MenuItem value="">No change</MenuItem>
												{MEMBER_ROLES.map((role) => (
													<MenuItem key={role} value={role}>
														{role}
													</MenuItem>
												))}
											</TextField>
										</Grid>
										<Grid size={12}>
											<TextField
												label="Reason"
												value={changeRequestReason}
												onChange={(event) =>
													setChangeRequestReason(event.target.value)
												}
												multiline
												rows={3}
												placeholder="Briefly explain why the admin-managed fields should change."
											/>
										</Grid>
									</Grid>

									{latestMemberChangeRequest && (
										<Box
											sx={{
												mt: 2.5,
												p: 2,
												borderRadius: 2,
												backgroundColor:
													theme.palette.mode === "light"
														? "rgba(154, 100, 217, 0.06)"
														: "rgba(27, 0, 73, 0.36)",
											}}
										>
											<Typography variant="subtitle2" sx={{ mb: 0.5 }}>
												Latest request:{" "}
												{latestMemberChangeRequest.status
													.charAt(0)
													.toUpperCase() +
													latestMemberChangeRequest.status.slice(1)}
											</Typography>
											{latestMemberChangeRequest.reason && (
												<Typography variant="body2" color="text.secondary">
													Reason: {latestMemberChangeRequest.reason}
												</Typography>
											)}
										</Box>
									)}

									<Button
										type="button"
										variant="outlined"
										onClick={handleSubmitMemberChangeRequest}
										disabled={isSubmittingChangeRequest}
										sx={{ mt: 2.5 }}
									>
										{isSubmittingChangeRequest
											? "Submitting request..."
											: "Request admin change"}
									</Button>
								</CardContent>
							</GlassCard>
						)}
					</Grid>

					<Grid size={{ xs: 12, lg: 5 }}>
						<GlassCard variant="elevated">
							<CardContent sx={{ p: 3 }}>
								<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
									Banking & Agreements
								</Typography>

								<Box sx={{ mb: 3 }}>
									<TextField
										label="IBAN"
										{...sepaForm.register("iban")}
										error={!!sepaForm.formState.errors.iban}
										helperText={sepaForm.formState.errors.iban?.message}
										sx={{ mb: 2, fontFamily: "monospace" }}
										required
									/>
									<TextField
										label="BIC"
										{...sepaForm.register("bic")}
										sx={{ mb: 2 }}
									/>
									<TextField
										label="Bank Name"
										{...sepaForm.register("bank_name")}
										error={!!sepaForm.formState.errors.bank_name}
										helperText={sepaForm.formState.errors.bank_name?.message}
										required
									/>
								</Box>

								<Box
									sx={{
										p: 2,
										borderRadius: 2,
										backgroundColor:
											theme.palette.mode === "light"
												? "rgba(139, 92, 246, 0.04)"
												: "rgba(255, 255, 255, 0.03)",
										border: `1px solid ${theme.palette.divider}`,
									}}
								>
									<FormControlLabel
										control={
											<Checkbox
												checked={mandateAgreed}
												onChange={(e) => {
													if (!mandateAgreed && e.target.checked) {
														setShowSepaModal(true);
													}
													sepaForm.setValue(
														"mandate_agreed",
														e.target.checked,
														{
															shouldDirty: true,
														},
													);
												}}
											/>
										}
										label={
											<Typography variant="body2">
												I agree to the{" "}
												<Box
													component="span"
													onClick={(e) => {
														e.preventDefault();
														setShowSepaModal(true);
													}}
													sx={{
														color: theme.palette.primary.main,
														cursor: "pointer",
														"&:hover": { textDecoration: "underline" },
													}}
												>
													SEPA mandate
												</Box>
											</Typography>
										}
										sx={{ mb: 1 }}
									/>

									<FormControlLabel
										control={
											<Checkbox
												checked={privacyAgreed}
												onChange={(e) => {
													if (!privacyAgreed && e.target.checked) {
														setShowPrivacyModal(true);
													}
													sepaForm.setValue(
														"privacy_agreed",
														e.target.checked,
														{
															shouldDirty: true,
														},
													);
												}}
											/>
										}
										label={
											<Typography variant="body2">
												I agree to the{" "}
												<Box
													component="span"
													onClick={(e) => {
														e.preventDefault();
														setShowPrivacyModal(true);
													}}
													sx={{
														color: theme.palette.primary.main,
														cursor: "pointer",
														"&:hover": { textDecoration: "underline" },
													}}
												>
													Privacy Policy
												</Box>{" "}
												*
											</Typography>
										}
									/>
								</Box>
							</CardContent>
						</GlassCard>

						<Button
							type="submit"
							variant="contained"
							size="large"
							fullWidth
							disabled={isUpdating}
							startIcon={
								isUpdating ? (
									<CircularProgress size={20} color="inherit" />
								) : (
									<SaveIcon />
								)
							}
							sx={{ mt: 3, py: 1.5 }}
						>
							{isUpdating ? "Saving..." : "Save Changes"}
						</Button>
					</Grid>
				</Grid>
			</form>

			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					confirmDisabled={!mandateAgreed}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, { shouldDirty: true });
						setShowSepaModal(false);
					}}
				>
					<SepaMandate
						sepaAgreed={mandateAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("mandate_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={() => setShowPrivacyModal(false)}
					confirmDisabled={!privacyAgreed}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, { shouldDirty: true });
						setShowPrivacyModal(false);
					}}
				>
					<PrivacyPolicy
						privacyAgreed={privacyAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("privacy_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}
		</Box>
	);
}
