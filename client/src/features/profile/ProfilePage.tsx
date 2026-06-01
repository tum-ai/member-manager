import { zodResolver } from "@hookform/resolvers/zod";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
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
	IconButton,
	MenuItem,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { useMemberChangeRequests } from "../../hooks/useMemberChangeRequests";
import { useMemberData } from "../../hooks/useMemberData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import { useSepaData } from "../../hooks/useSepaData";
import {
	BATCH_OPTIONS,
	DEPARTMENTS,
	getCurrentBatch,
	MEMBER_ROLES,
} from "../../lib/constants";
import {
	isLinkedinProfileUrl,
	normalizeLinkedinProfileUrl,
} from "../../lib/linkedin";
import {
	getEducationEntries,
	getMemberStatusLabel,
	resolveDepartmentForMemberRole,
	serializeEducationEntries,
} from "../../lib/memberMetadata";
import { downloadPdfBlob } from "../../lib/pdfUtils";
import {
	type LinkedinSchema,
	linkedinSchema,
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "../../lib/schemas";
import { generateMembershipProofPdf } from "../certificate/generators/membershipProofPdf";
import DataPrivacyNotice from "../legal/DataPrivacyNotice";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import SepaMandate from "../sepa/SepaMandate";
import CvPanel from "./CvPanel";
import EducationFields from "./EducationFields";
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
	const [showDataPrivacyNoticeModal, setShowDataPrivacyNoticeModal] =
		useState(false);
	const [pendingMandateAgreed, setPendingMandateAgreed] = useState(false);
	const [pendingPrivacyAgreed, setPendingPrivacyAgreed] = useState(false);
	const [pendingDataPrivacyNoticeAgreed, setPendingDataPrivacyNoticeAgreed] =
		useState(false);
	const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
	const [requestedRole, setRequestedRole] = useState("");
	const [requestedDepartment, setRequestedDepartment] = useState("");
	const [isRequestingAlumniStatus, setIsRequestingAlumniStatus] =
		useState(false);
	const [changeRequestReason, setChangeRequestReason] = useState("");

	const normalizeTextValue = (value?: string | null): string | null => {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	};

	const normalizeSerializedTextValue = (
		value?: string | null,
	): string | null => {
		if (!value?.trim()) return null;
		return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	};

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);
	const { isAdmin, isLoading: isLoadingAdminRole } = useIsAdmin(user.id);
	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();
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

	const linkedinForm = useForm<LinkedinSchema>({
		resolver: zodResolver(linkedinSchema),
		defaultValues: {
			linkedin_profile_url: "",
			public_location: "",
		},
	});

	const linkedinUrl = linkedinForm.watch("linkedin_profile_url");
	const normalizedLinkedinUrl = normalizeLinkedinProfileUrl(linkedinUrl);
	const isLinkedinUrlValid = isLinkedinProfileUrl(linkedinUrl);

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
			data_privacy_notice_agreed: false,
			user_id: user.id,
		},
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const dataPrivacyNoticeAgreed = sepaForm.watch("data_privacy_notice_agreed");
	const isActive = memberForm.watch("active");
	const shouldSubmitSepa = Boolean(sepaData) || sepaForm.formState.isDirty;

	const openSepaModal = () => {
		setPendingMandateAgreed(mandateAgreed);
		setShowSepaModal(true);
	};

	const openPrivacyModal = () => {
		setPendingPrivacyAgreed(privacyAgreed);
		setShowPrivacyModal(true);
	};

	const openDataPrivacyNoticeModal = () => {
		setPendingDataPrivacyNoticeAgreed(dataPrivacyNoticeAgreed);
		setShowDataPrivacyNoticeModal(true);
	};

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
			research_project_id: existing.research_project_id || "",
			degree: existing.degree || "",
			school: existing.school || "",
		});

		// Populate LinkedIn form from DB data
		linkedinForm.reset({
			linkedin_profile_url:
				((existing as Record<string, unknown>)
					.linkedin_profile_url as string) || "",
			public_location:
				((existing as Record<string, unknown>).public_location as string) || "",
		});
	}, [memberData, isLoadingMember, memberForm, linkedinForm, user]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				data_privacy_notice_agreed:
					sepaData.data_privacy_notice_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async (): Promise<void> => {
		try {
			const memberValid = await memberForm.trigger();
			const linkedinValid = await linkedinForm.trigger();
			const sepaValid = shouldSubmitSepa ? await sepaForm.trigger() : true;

			if (!memberValid || !linkedinValid || !sepaValid) {
				showToast(
					shouldSubmitSepa
						? "Please complete all required fields and agreements before saving."
						: "Please complete all required profile fields before saving.",
					"error",
				);
				return;
			}

			const promises: Promise<unknown>[] = [];
			const memberValues = memberForm.getValues();
			const linkedinValues = linkedinForm.getValues();
			const educationValues = serializeEducationEntries(
				getEducationEntries(memberValues.degree, memberValues.school),
			);
			const memberPayload = {
				...buildSelfServiceMemberUpdatePayload(memberValues, {
					includeAdminManagedFields: isAdmin,
				}),
				degree: normalizeSerializedTextValue(educationValues.degree),
				school: normalizeSerializedTextValue(educationValues.school),
				// LinkedIn fields submitted with the member payload
				linkedin_profile_url: normalizeTextValue(
					linkedinValues.linkedin_profile_url,
				),
				public_location: normalizeTextValue(linkedinValues.public_location),
			};
			let effectiveProfileDepartment = normalizeTextValue(
				memberValues.department,
			);
			if (isAdmin) {
				Object.assign(memberPayload, {
					batch: normalizeTextValue(memberValues.batch),
				});
				const normalizedRole = normalizeTextValue(memberValues.member_role);
				effectiveProfileDepartment = resolveDepartmentForMemberRole(
					normalizedRole || "Member",
					normalizeTextValue(memberValues.department),
				);
				Object.assign(memberPayload, {
					member_role: normalizedRole || "Member",
					department: effectiveProfileDepartment,
				});
			}
			if (effectiveProfileDepartment === "Research") {
				Object.assign(memberPayload, {
					research_project_id: normalizeTextValue(
						memberValues.research_project_id,
					),
				});
			} else if (isAdmin) {
				Object.assign(memberPayload, { research_project_id: null });
			} else {
				delete memberPayload.research_project_id;
			}
			promises.push(updateMemberAsync(memberPayload));
			if (shouldSubmitSepa) {
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
	const currentRole = memberForm.watch("member_role") || "Member";
	const currentDepartment = memberForm.watch("department") || "";
	const effectiveProfileDepartment = resolveDepartmentForMemberRole(
		currentRole,
		currentDepartment,
	);
	const researchProjectOptions = (researchProjects ?? []).filter((project) => {
		const status = project.status?.trim().toLowerCase();
		return !status || ["ongoing", "active", "in progress"].includes(status);
	});
	const isResearchDepartmentSelected =
		effectiveProfileDepartment === "Research";

	const handleSubmitMemberChangeRequest = async (): Promise<void> => {
		const memberRole = normalizeTextValue(requestedRole);
		const department = normalizeTextValue(requestedDepartment);
		const reason = changeRequestReason.trim();

		if (!memberRole && !department && !isRequestingAlumniStatus) {
			showToast(
				"Select a role, department, or alumni status change to request.",
				"warning",
			);
			return;
		}

		try {
			const changes: {
				member_role?: string;
				member_status?: string;
				department?: string;
			} = {};
			if (memberRole) changes.member_role = memberRole;
			if (department) changes.department = department;
			if (isRequestingAlumniStatus) changes.member_status = "alumni";

			await submitChangeRequestAsync({
				changes,
				reason: reason || undefined,
			});
			setRequestedRole("");
			setRequestedDepartment("");
			setIsRequestingAlumniStatus(false);
			setChangeRequestReason("");
			showToast("Change request sent to the admin and LnF team.", "success");
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
											helperText={memberForm.formState.errors.batch?.message}
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
												value={currentDepartment}
												onChange={(event) => {
													memberForm.setValue(
														"department",
														event.target.value,
														{
															shouldDirty: true,
														},
													);
													if (event.target.value !== "Research") {
														memberForm.setValue("research_project_id", "", {
															shouldDirty: true,
														});
													}
												}}
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
												value={currentDepartment || "Not set"}
												helperText="Departments are assigned by admins. Request a change below."
												disabled
											/>
										)}
									</Grid>

									<Grid size={{ xs: 12, sm: 6 }}>
										{isAdmin ? (
											<TextField
												select
												label="Role in TUM.ai"
												value={currentRole}
												onChange={(event) => {
													memberForm.setValue(
														"member_role",
														event.target.value,
														{
															shouldDirty: true,
														},
													);
													const nextDepartment = resolveDepartmentForMemberRole(
														event.target.value,
														currentDepartment,
													);
													if (nextDepartment !== currentDepartment) {
														memberForm.setValue(
															"department",
															nextDepartment || "",
															{
																shouldDirty: true,
															},
														);
													}
													if (nextDepartment !== "Research") {
														memberForm.setValue("research_project_id", "", {
															shouldDirty: true,
														});
													}
												}}
												helperText="Admins manage role assignments."
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
												value={currentRole}
												helperText="Roles are assigned by admins"
												disabled
											/>
										)}
									</Grid>
									{isResearchDepartmentSelected && (
										<Grid size={{ xs: 12, sm: 6 }}>
											<TextField
												select
												label="Research project"
												value={memberForm.watch("research_project_id") || ""}
												onChange={(event) =>
													memberForm.setValue(
														"research_project_id",
														event.target.value,
														{ shouldDirty: true },
													)
												}
												disabled={isLoadingResearchProjects}
												helperText="Pick the research project you are part of."
											>
												<MenuItem value="">No project selected</MenuItem>
												{researchProjectOptions.map((project) => (
													<MenuItem key={project.id} value={project.id}>
														{project.title}
													</MenuItem>
												))}
											</TextField>
										</Grid>
									)}
									<EducationFields
										degreeValue={memberForm.watch("degree")}
										schoolValue={memberForm.watch("school")}
										onChange={(values) => {
											memberForm.setValue("degree", values.degree, {
												shouldDirty: true,
											});
											memberForm.setValue("school", values.school, {
												shouldDirty: true,
											});
										}}
									/>
								</Grid>
							</CardContent>
						</GlassCard>

						{/* ── LinkedIn & Location ── */}
						<GlassCard variant="elevated" sx={{ mt: 3 }}>
							<CardContent sx={{ p: 3 }}>
								<Box
									sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}
								>
									<LinkedInIcon sx={{ color: "primary.main" }} />
									<Typography variant="h6" sx={{ fontWeight: 500 }}>
										LinkedIn & Location
									</Typography>
								</Box>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{ mb: 3 }}
								>
									This data is visible to other TUM.ai members.
								</Typography>

								<Grid container spacing={2}>
									<Grid size={12}>
										<TextField
											label="LinkedIn Profile URL"
											placeholder="https://linkedin.com/in/your-profile"
											{...linkedinForm.register("linkedin_profile_url")}
											error={
												!!linkedinForm.formState.errors.linkedin_profile_url
											}
											helperText={
												linkedinForm.formState.errors.linkedin_profile_url
													?.message
											}
											slotProps={{
												input: {
													endAdornment: isLinkedinUrlValid ? (
														<Button
															size="small"
															component="a"
															href={normalizedLinkedinUrl}
															aria-label="View LinkedIn profile"
															target="_blank"
															rel="noopener noreferrer"
															sx={{ minWidth: 0, px: 1, color: "primary.main" }}
														>
															<LinkedInIcon fontSize="small" />
														</Button>
													) : undefined,
												},
											}}
										/>
									</Grid>

									<Grid size={{ xs: 12, sm: 6 }}>
										<TextField
											label="Public location"
											placeholder="Munich, Germany"
											{...linkedinForm.register("public_location")}
											helperText="Shown on your member profile; separate from your address."
										/>
									</Grid>
								</Grid>
							</CardContent>
						</GlassCard>

						<CvPanel userId={user.id} />

						{!isAdmin && (
							<GlassCard variant="elevated" sx={{ mt: 3 }}>
								<CardContent sx={{ p: 3 }}>
									<Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
										Request Role, Department, or Status Changes
									</Typography>

									<Grid container spacing={2}>
										<Grid size={12}>
											<TextField
												select
												label="Requested role"
												value={requestedRole}
												onChange={(event) =>
													setRequestedRole(event.target.value)
												}
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
												select
												label="Requested department"
												value={requestedDepartment}
												onChange={(event) =>
													setRequestedDepartment(event.target.value)
												}
												helperText="Department changes are reviewed by an admin."
											>
												<MenuItem value="">No change</MenuItem>
												{DEPARTMENTS.map((department) => (
													<MenuItem key={department} value={department}>
														{department}
													</MenuItem>
												))}
											</TextField>
										</Grid>
										<Grid size={12}>
											<Box
												sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
											>
												<FormControlLabel
													control={
														<Checkbox
															checked={isRequestingAlumniStatus}
															onChange={(event) =>
																setIsRequestingAlumniStatus(
																	event.target.checked,
																)
															}
														/>
													}
													label="Request alumni status"
												/>
												<Tooltip title="Alumni requests are eligible after two active semesters and are reviewed by Legal & Finance.">
													<IconButton
														type="button"
														size="small"
														aria-label="Alumni status request information"
													>
														<InfoOutlinedIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											</Box>
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
												placeholder="Briefly explain why your role or status should change."
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
											: "Request changes"}
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
													if (e.target.checked) {
														openSepaModal();
														return;
													}
													sepaForm.setValue("mandate_agreed", false, {
														shouldDirty: true,
														shouldValidate: true,
													});
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
														e.stopPropagation();
														openSepaModal();
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
										sx={{ mb: 0.5 }}
									/>
									{sepaForm.formState.errors.mandate_agreed && (
										<Typography
											color="error"
											variant="caption"
											sx={{ display: "block", mb: 1 }}
										>
											{sepaForm.formState.errors.mandate_agreed.message}
										</Typography>
									)}

									<FormControlLabel
										control={
											<Checkbox
												checked={privacyAgreed}
												onChange={(e) => {
													if (e.target.checked) {
														openPrivacyModal();
														return;
													}
													sepaForm.setValue("privacy_agreed", false, {
														shouldDirty: true,
														shouldValidate: true,
													});
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
														e.stopPropagation();
														openPrivacyModal();
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
									{sepaForm.formState.errors.privacy_agreed && (
										<Typography
											color="error"
											variant="caption"
											sx={{ display: "block", mb: 1 }}
										>
											{sepaForm.formState.errors.privacy_agreed.message}
										</Typography>
									)}

									<FormControlLabel
										control={
											<Checkbox
												checked={dataPrivacyNoticeAgreed}
												onChange={(e) => {
													if (e.target.checked) {
														openDataPrivacyNoticeModal();
														return;
													}
													sepaForm.setValue(
														"data_privacy_notice_agreed",
														false,
														{
															shouldDirty: true,
															shouldValidate: true,
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
														e.stopPropagation();
														openDataPrivacyNoticeModal();
													}}
													sx={{
														color: theme.palette.primary.main,
														cursor: "pointer",
														"&:hover": { textDecoration: "underline" },
													}}
												>
													Data Privacy Notice
												</Box>{" "}
												*
											</Typography>
										}
									/>
									{sepaForm.formState.errors.data_privacy_notice_agreed && (
										<Typography
											color="error"
											variant="caption"
											sx={{ display: "block" }}
										>
											{
												sepaForm.formState.errors.data_privacy_notice_agreed
													.message
											}
										</Typography>
									)}
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
					confirmDisabled={!pendingMandateAgreed}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowSepaModal(false);
					}}
				>
					<SepaMandate
						sepaAgreed={pendingMandateAgreed}
						onCheckChange={setPendingMandateAgreed}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={() => setShowPrivacyModal(false)}
					confirmDisabled={!pendingPrivacyAgreed}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowPrivacyModal(false);
					}}
				>
					<PrivacyPolicy
						privacyAgreed={pendingPrivacyAgreed}
						onCheckChange={setPendingPrivacyAgreed}
					/>
				</Modal>
			)}

			{showDataPrivacyNoticeModal && (
				<Modal
					title="Data Privacy Notice Agreement"
					onClose={() => setShowDataPrivacyNoticeModal(false)}
					confirmDisabled={!pendingDataPrivacyNoticeAgreed}
					onConfirm={() => {
						sepaForm.setValue("data_privacy_notice_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowDataPrivacyNoticeModal(false);
					}}
				>
					<DataPrivacyNotice
						dataPrivacyNoticeAgreed={pendingDataPrivacyNoticeAgreed}
						onCheckChange={setPendingDataPrivacyNoticeAgreed}
					/>
				</Modal>
			)}
		</Box>
	);
}
