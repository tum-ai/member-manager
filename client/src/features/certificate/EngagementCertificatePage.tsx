import { zodResolver } from "@hookform/resolvers/zod";
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	Download as DownloadIcon,
} from "@mui/icons-material";
import {
	Box,
	Button,
	Checkbox,
	CircularProgress,
	FormControlLabel,
	Grid,
	IconButton,
	MenuItem,
	TextField,
	Typography,
} from "@mui/material";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useEngagementCertificateRequests } from "../../hooks/useEngagementCertificateRequests";
import { useMemberData } from "../../hooks/useMemberData";
import { DEPARTMENTS, WEEKLY_HOURS_OPTIONS } from "../../lib/constants";
import { downloadPdfBlob, formatGermanDate } from "../../lib/pdfUtils";
import {
	type EngagementFormSchema,
	type EngagementSchema,
	engagementFormSchema,
} from "../../lib/schemas";
import ToolPageShell from "../tools/ToolPageShell";
import { generateEngagementCertificatePdf } from "./generators/engagementCertificatePdf";

interface Props {
	user: User;
}

function createDefaultEngagement(): EngagementSchema {
	return {
		id: crypto.randomUUID(),
		startDate: "",
		endDate: "",
		isStillActive: false,
		weeklyHours: "",
		department: "",
		isTeamLead: false,
		tasksDescription: "",
	};
}

export default function EngagementCertificatePage({
	user,
}: Props): JSX.Element {
	const { member, isLoading, error: fetchError } = useMemberData(user.id);
	const { requests, submitRequestAsync, isSubmitting } =
		useEngagementCertificateRequests(user.id);
	const { showToast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);

	const form = useForm<EngagementFormSchema>({
		resolver: zodResolver(engagementFormSchema),
		defaultValues: {
			engagements: [createDefaultEngagement()],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "engagements",
	});

	const latestRequest = requests[0];
	const approvedRequest = requests.find(
		(request) => request.status === "approved",
	);
	const isRequestPending = latestRequest?.status === "pending";

	const handleSubmitForApproval = async (
		data: EngagementFormSchema,
	): Promise<void> => {
		if (!member) {
			showToast("Member data not available", "error");
			return;
		}

		try {
			await submitRequestAsync(data);
			showToast("Certificate request submitted for admin approval.", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(
				`Error submitting certificate request: ${errorMessage}`,
				"error",
			);
		} finally {
			form.reset({
				engagements: data.engagements,
			});
		}
	};

	const handleDownloadApproved = async (): Promise<void> => {
		if (!member || !approvedRequest || isGenerating) {
			return;
		}

		setIsGenerating(true);
		try {
			const pdfBlob = await generateEngagementCertificatePdf(
				member,
				approvedRequest.engagements,
			);
			const safeGivenName = member.given_name.replace(/[^a-zA-Z0-9-_]/g, "-");
			const safeSurname = member.surname.replace(/[^a-zA-Z0-9-_]/g, "-");
			const fullName = `${safeGivenName}-${safeSurname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Engagement_Certificate_${fullName}.pdf`);
			showToast("Approved certificate downloaded successfully!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error generating certificate: ${errorMessage}`, "error");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddEngagement = (): void => {
		if (fields.length >= 5) {
			showToast("Maximum 5 engagements allowed", "warning");
			return;
		}
		append(createDefaultEngagement());
	};

	const handleRemoveEngagement = (index: number): void => {
		if (fields.length <= 1) {
			showToast("At least one engagement is required", "warning");
			return;
		}
		remove(index);
	};

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "50vh",
					gap: 2,
				}}
			>
				<CircularProgress />
				<Typography variant="h6" color="text.secondary">
					Loading...
				</Typography>
			</Box>
		);
	}

	if (fetchError) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="error">
					Error loading member data: {fetchError.message}
				</Typography>
			</Box>
		);
	}

	if (!member) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="text.secondary">No member data found.</Typography>
			</Box>
		);
	}

	if (
		(member.member_status || (member.active ? "active" : "inactive")) !==
		"active"
	) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="text.secondary">
					This feature is only available for active members.
				</Typography>
			</Box>
		);
	}

	const birthDate = formatGermanDate(member.date_of_birth);

	return (
		<ToolPageShell
			title="Engagement Certificate"
			description="Submit engagement details for admin review."
		>
			<GlassCard sx={{ mb: 3 }}>
				<Box sx={{ p: 3 }}>
					<Typography variant="body1" sx={{ mb: 2 }}>
						Submit your engagement details for an admin review before the final
						certificate is released. Please enter{" "}
						<strong>accurate information</strong> for each period you were
						actively involved.
					</Typography>

					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						<strong>Important:</strong> Everything you enter below will be
						reviewed by an admin and appear in the final certificate only after
						approval. Make sure names, dates, and responsibilities are correct
						and complete.
					</Typography>

					{latestRequest && (
						<Box
							sx={{
								p: 2,
								borderRadius: 1,
								bgcolor: "rgba(154, 100, 217, 0.08)",
								mb: 2,
							}}
						>
							<Typography variant="subtitle2" sx={{ mb: 0.5 }}>
								Current request status: {latestRequest.status}
							</Typography>
							{latestRequest.review_note && (
								<Typography variant="body2" color="text.secondary">
									Admin note: {latestRequest.review_note}
								</Typography>
							)}
						</Box>
					)}

					<Box
						sx={{
							p: 2,
							borderRadius: 1,
							bgcolor: "rgba(255, 255, 255, 0.05)",
							mb: 2,
						}}
					>
						<Typography variant="body2">
							This is to confirm that{" "}
							<strong>
								{member.salutation} {member.given_name} {member.surname}
							</strong>
							{birthDate === "Not provided" ? "" : ", born on "}
							{birthDate === "Not provided" ? null : (
								<strong>{birthDate}</strong>
							)}
							, has voluntarily engaged with <strong>TUM.ai</strong>.
						</Typography>
					</Box>
				</Box>
			</GlassCard>

			<form onSubmit={form.handleSubmit(handleSubmitForApproval)}>
				{fields.map((field, index) => (
					<GlassCard key={field.id} sx={{ mb: 3 }}>
						<Box sx={{ p: 3 }}>
							<Box
								sx={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									mb: 2,
								}}
							>
								<Typography variant="h6" sx={{ fontWeight: 500 }}>
									Engagement #{index + 1}
								</Typography>
								{fields.length > 1 && (
									<IconButton
										color="error"
										onClick={() => handleRemoveEngagement(index)}
										size="small"
										aria-label={`Remove engagement ${index + 1}`}
									>
										<DeleteIcon />
									</IconButton>
								)}
							</Box>

							<Grid container spacing={2}>
								<Grid size={{ xs: 12, md: 6 }}>
									<TextField
										fullWidth
										label="Start Date"
										type="date"
										{...form.register(`engagements.${index}.startDate`)}
										error={
											!!form.formState.errors.engagements?.[index]?.startDate
										}
										helperText={
											form.formState.errors.engagements?.[index]?.startDate
												?.message
										}
										slotProps={{
											inputLabel: { shrink: true },
										}}
										required
									/>
								</Grid>

								<Grid size={{ xs: 12, md: 6 }}>
									<FormControlLabel
										control={
											<Checkbox
												{...form.register(`engagements.${index}.isStillActive`)}
											/>
										}
										label="I am still active in this role"
									/>
								</Grid>

								{!form.watch(`engagements.${index}.isStillActive`) && (
									<Grid size={{ xs: 12, md: 6 }}>
										<TextField
											fullWidth
											label="End Date"
											type="date"
											{...form.register(`engagements.${index}.endDate`)}
											error={
												!!form.formState.errors.engagements?.[index]?.endDate
											}
											helperText={
												form.formState.errors.engagements?.[index]?.endDate
													?.message
											}
											slotProps={{
												inputLabel: { shrink: true },
											}}
											required
										/>
									</Grid>
								)}

								<Grid size={{ xs: 12, md: 6 }}>
									<TextField
										select
										fullWidth
										label="Weekly Hours"
										{...form.register(`engagements.${index}.weeklyHours`)}
										value={form.watch(`engagements.${index}.weeklyHours`) || ""}
										error={
											!!form.formState.errors.engagements?.[index]?.weeklyHours
										}
										helperText={
											form.formState.errors.engagements?.[index]?.weeklyHours
												?.message
										}
									>
										<MenuItem value="">Select</MenuItem>
										{WEEKLY_HOURS_OPTIONS.map((hours) => (
											<MenuItem key={hours} value={hours.toString()}>
												{hours} hours
											</MenuItem>
										))}
									</TextField>
								</Grid>

								<Grid size={{ xs: 12, md: 6 }}>
									<TextField
										select
										fullWidth
										label="Department"
										slotProps={{
											select: {
												SelectDisplayProps: {
													"aria-label": "Department",
												},
											},
										}}
										{...form.register(`engagements.${index}.department`)}
										value={form.watch(`engagements.${index}.department`) || ""}
										error={
											!!form.formState.errors.engagements?.[index]?.department
										}
										helperText={
											form.formState.errors.engagements?.[index]?.department
												?.message
										}
										required
									>
										<MenuItem value="">Select</MenuItem>
										{DEPARTMENTS.map((dept) => (
											<MenuItem key={dept} value={dept}>
												{dept}
											</MenuItem>
										))}
									</TextField>
								</Grid>

								<Grid size={{ xs: 12 }}>
									<FormControlLabel
										control={
											<Checkbox
												{...form.register(`engagements.${index}.isTeamLead`)}
											/>
										}
										label="I was a team lead"
									/>
								</Grid>

								<Grid size={{ xs: 12 }}>
									<TextField
										fullWidth
										multiline
										rows={4}
										label="Tasks / Responsibilities"
										placeholder="List each responsibility on a new line"
										{...form.register(`engagements.${index}.tasksDescription`)}
										error={
											!!form.formState.errors.engagements?.[index]
												?.tasksDescription
										}
										helperText={
											form.formState.errors.engagements?.[index]
												?.tasksDescription?.message || (
												<Box
													component="span"
													sx={{
														display: "flex",
														justifyContent: "space-between",
													}}
												>
													<span>Enter each task on a new line</span>
													<span>
														{
															(
																form.watch(
																	`engagements.${index}.tasksDescription`,
																) || ""
															).length
														}
														/1000 chars
													</span>
												</Box>
											)
										}
										required
									/>
								</Grid>
							</Grid>
						</Box>
					</GlassCard>
				))}

				<Box sx={{ display: "flex", gap: 2, mb: 3 }}>
					<Button
						variant="outlined"
						startIcon={<AddIcon />}
						onClick={handleAddEngagement}
						disabled={fields.length >= 5}
					>
						Add Another Engagement
					</Button>

					<Box sx={{ flex: 1 }} />

					<Button
						type="submit"
						variant="contained"
						size="large"
						startIcon={
							isSubmitting ? (
								<CircularProgress size={20} color="inherit" />
							) : (
								<DownloadIcon />
							)
						}
						disabled={isSubmitting || isRequestPending}
					>
						{isSubmitting
							? "Submitting..."
							: isRequestPending
								? "Awaiting Admin Review"
								: "Submit for Approval"}
					</Button>
				</Box>

				{approvedRequest && (
					<Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
						<Button
							type="button"
							variant="outlined"
							startIcon={
								isGenerating ? (
									<CircularProgress size={18} color="inherit" />
								) : (
									<DownloadIcon />
								)
							}
							onClick={handleDownloadApproved}
							disabled={isGenerating}
						>
							{isGenerating
								? "Generating approved certificate..."
								: "Download Approved Certificate"}
						</Button>
					</Box>
				)}

				<Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
					* All fields are required
				</Typography>
			</form>
		</ToolPageShell>
	);
}
