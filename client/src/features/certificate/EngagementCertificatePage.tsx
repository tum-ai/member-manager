import { zodResolver } from "@hookform/resolvers/zod";
import {
	Add as AddIcon,
	ArrowBack as ArrowBackIcon,
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
import { useNavigate } from "react-router-dom";

import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import { DEPARTMENTS, WEEKLY_HOURS_OPTIONS } from "../../lib/constants";
import {
	type EngagementFormSchema,
	engagementFormSchema,
} from "../../lib/schemas";
import {
	downloadPdfBlob,
	generateEngagementCertificatePdf,
} from "./generators/engagementCertificatePdf";

interface Props {
	user: User;
}

function createDefaultEngagement() {
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

export default function EngagementCertificatePage({ user }: Props) {
	const { member, isLoading, error: fetchError } = useMemberData(user.id);
	const { showToast } = useToast();
	const [isGenerating, setIsGenerating] = useState(false);
	const navigate = useNavigate();

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

	const handleDownload = async (data: EngagementFormSchema) => {
		if (!member) {
			showToast("Member data not available", "error");
			return;
		}

		setIsGenerating(true);
		try {
			const pdfBlob = await generateEngagementCertificatePdf(
				member,
				data.engagements,
			);
			const fullName = `${member.given_name} ${member.surname}`;
			downloadPdfBlob(pdfBlob, `TUMai_Engagement_Certificate_${fullName}.pdf`);
			showToast("Certificate downloaded successfully!", "success");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			if (import.meta.env.DEV) {
				console.error("Error generating PDF:", error);
			}
			showToast(`Error generating certificate: ${errorMessage}`, "error");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddEngagement = () => {
		if (fields.length >= 5) {
			showToast("Maximum 5 engagements allowed", "warning");
			return;
		}
		append(createDefaultEngagement());
	};

	const handleRemoveEngagement = (index: number) => {
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

	if (!member.active) {
		return (
			<Box sx={{ p: 3 }}>
				<Typography color="text.secondary">
					This feature is only available for active members.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
				<Button
					variant="outlined"
					startIcon={<ArrowBackIcon />}
					onClick={() => navigate("/")}
					size="medium"
				>
					Back to Profile
				</Button>
			</Box>

			<GlassCard sx={{ mb: 3 }}>
				<Box sx={{ p: 3 }}>
					<Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
						Engagement Certificate
					</Typography>

					<Typography variant="body1" sx={{ mb: 2 }}>
						This form generates a personalized <strong>PDF certificate</strong>{" "}
						confirming your voluntary engagement with <strong>TUM.ai</strong>.
						Please enter <strong>accurate information</strong> for each period
						you were actively involved.
					</Typography>

					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						<strong>Important:</strong> Everything you enter below will directly
						appear in the final certificate. Make sure names, dates, and
						responsibilities are correct and complete.
					</Typography>

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
							, born on{" "}
							<strong>
								{new Date(member.date_of_birth).toLocaleDateString("de-DE")}
							</strong>
							, has voluntarily engaged with <strong>TUM.ai</strong>.
						</Typography>
					</Box>
				</Box>
			</GlassCard>

			<form onSubmit={form.handleSubmit(handleDownload)}>
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
										required
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
												?.tasksDescription?.message ||
											"Enter each task on a new line"
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
							isGenerating ? (
								<CircularProgress size={20} color="inherit" />
							) : (
								<DownloadIcon />
							)
						}
						disabled={isGenerating}
					>
						{isGenerating ? "Generating..." : "Download Certificate"}
					</Button>
				</Box>

				<Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
					* All fields are required
				</Typography>
			</form>
		</Box>
	);
}
