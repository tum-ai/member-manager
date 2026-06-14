import {
	Add as AddIcon,
	Business as BusinessIcon,
	EmailOutlined as EmailOutlinedIcon,
	LocationOnOutlined as LocationOnOutlinedIcon,
	OpenInNew as OpenInNewIcon,
	SendOutlined as SendOutlinedIcon,
	WorkOutline as WorkOutlineIcon,
} from "@mui/icons-material";
import {
	Alert,
	Avatar,
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	MenuItem,
	Stack,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type React from "react";
import { useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import {
	type JobPostingRequest,
	type JobPostingRequestPayload,
	type JobType,
	type PartnerJob,
	useJobs,
} from "../../hooks/useJobs";
import ToolPageShell from "../tools/ToolPageShell";

const jobTypeLabels: Record<JobType, string> = {
	internship: "Internship",
	working_student: "Working student",
	full_time: "Full-time",
	thesis: "Thesis",
	other: "Other",
};

const jobTypeOptions = Object.entries(jobTypeLabels) as Array<
	[JobType, string]
>;

type JobSubmissionFormState = {
	title: string;
	organization_name: string;
	logo_url: string;
	description_markdown: string;
	call_to_action: string;
	job_type: JobType;
	location: string;
	contact_name: string;
	contact_email: string;
	contact_role: string;
	external_url: string;
	expires_at: string;
};

const emptyJobForm: JobSubmissionFormState = {
	title: "",
	organization_name: "",
	logo_url: "",
	description_markdown: "",
	call_to_action: "Apply now",
	job_type: "working_student",
	location: "",
	contact_name: "",
	contact_email: "",
	contact_role: "",
	external_url: "",
	expires_at: "",
};

function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function getOptionalValue(value: string): string | null {
	const trimmed = value.trim();
	return trimmed || null;
}

function getSafeHttpUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? value : null;
	} catch {
		return null;
	}
}

function getStatusChipColor(
	status: JobPostingRequest["status"],
): "default" | "success" | "warning" | "error" {
	if (status === "approved") return "success";
	if (status === "rejected") return "error";
	return "warning";
}

function getApplyHref(job: PartnerJob): string {
	return getSafeHttpUrl(job.external_url) ?? `mailto:${job.contact.email}`;
}

function getApplyLabel(job: PartnerJob): string {
	return (
		job.call_to_action.trim() ||
		(getSafeHttpUrl(job.external_url) ? "Open posting" : "Contact")
	);
}

function JobCard({ job }: { job: PartnerJob }): React.ReactElement {
	const theme = useTheme();
	const logoUrl = job.logo_url ?? job.partner.logo_url;
	const applyHref = getApplyHref(job);
	const applyLabel = getApplyLabel(job);
	const safeExternalUrl = getSafeHttpUrl(job.external_url);

	return (
		<GlassCard variant="elevated" sx={{ height: "100%" }}>
			<CardContent
				sx={{
					p: { xs: 2.5, md: 3 },
					height: "100%",
					display: "flex",
					flexDirection: "column",
					gap: 2.25,
				}}
			>
				<Stack direction="row" spacing={2} alignItems="flex-start">
					<Avatar
						src={logoUrl ?? undefined}
						alt={job.partner.name}
						variant="rounded"
						sx={{
							width: 52,
							height: 52,
							bgcolor: alpha(theme.palette.primary.main, 0.12),
							color: "primary.main",
						}}
					>
						<BusinessIcon />
					</Avatar>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography variant="h5" sx={{ mb: 0.5 }}>
							{job.title}
						</Typography>
						<Typography color="text.secondary">{job.partner.name}</Typography>
					</Box>
				</Stack>

				<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
					<Chip label={jobTypeLabels[job.job_type]} size="small" />
					<Chip
						icon={<LocationOnOutlinedIcon />}
						label={job.location}
						size="small"
						variant="outlined"
					/>
				</Stack>

				<Typography
					color="text.secondary"
					sx={{
						whiteSpace: "pre-line",
						display: "-webkit-box",
						WebkitLineClamp: 5,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}}
				>
					{job.description_markdown}
				</Typography>

				<Box sx={{ flex: 1 }} />
				<Divider />

				<Stack
					direction={{ xs: "column", sm: "row" }}
					spacing={1.5}
					alignItems={{ xs: "stretch", sm: "center" }}
					justifyContent="space-between"
				>
					<Box>
						<Typography variant="body2" color="text.secondary">
							Published {formatDate(job.published_at)}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Contact: {job.contact.name}
							{job.contact.role ? `, ${job.contact.role}` : ""}
						</Typography>
					</Box>
					<Button
						component="a"
						href={applyHref}
						target={safeExternalUrl ? "_blank" : undefined}
						rel={safeExternalUrl ? "noopener noreferrer" : undefined}
						variant="contained"
						endIcon={
							safeExternalUrl ? <OpenInNewIcon /> : <EmailOutlinedIcon />
						}
						sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
					>
						{applyLabel}
					</Button>
				</Stack>
			</CardContent>
		</GlassCard>
	);
}

function JobSubmissionPanel({
	requests,
	onOpenForm,
}: {
	requests: JobPostingRequest[];
	onOpenForm: () => void;
}): React.ReactElement {
	return (
		<GlassCard variant="elevated">
			<CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					spacing={2}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", md: "center" }}
				>
					<Box>
						<Typography variant="h5">Member job submissions</Typography>
						<Typography color="text.secondary" sx={{ mt: 0.5 }}>
							Approved member postings are published on the board.
						</Typography>
					</Box>
					<Button
						type="button"
						variant="contained"
						startIcon={<AddIcon />}
						onClick={onOpenForm}
					>
						Post job
					</Button>
				</Stack>

				<Divider sx={{ my: 2.5 }} />

				{requests.length === 0 ? (
					<Typography color="text.secondary">No submitted jobs yet.</Typography>
				) : (
					<Stack spacing={1.5}>
						{requests.map((request) => (
							<Box
								key={request.id}
								sx={{
									display: "flex",
									flexDirection: { xs: "column", sm: "row" },
									alignItems: { xs: "flex-start", sm: "center" },
									justifyContent: "space-between",
									gap: 1.5,
								}}
							>
								<Box sx={{ minWidth: 0 }}>
									<Typography sx={{ fontWeight: 700 }}>
										{request.title}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{request.organization_name} ·{" "}
										{jobTypeLabels[request.job_type]} · {request.location}
									</Typography>
								</Box>
								<Chip
									label={request.status}
									color={getStatusChipColor(request.status)}
									size="small"
									sx={{ textTransform: "capitalize" }}
								/>
							</Box>
						))}
					</Stack>
				)}
			</CardContent>
		</GlassCard>
	);
}

function JobSubmissionDialog({
	open,
	form,
	isSubmitting,
	onClose,
	onChange,
	onSubmit,
}: {
	open: boolean;
	form: JobSubmissionFormState;
	isSubmitting: boolean;
	onClose: () => void;
	onChange: (field: keyof JobSubmissionFormState, value: string) => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}): React.ReactElement {
	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
			<Box component="form" onSubmit={onSubmit}>
				<DialogTitle>Post a job</DialogTitle>
				<DialogContent>
					<Grid container spacing={2} sx={{ pt: 1 }}>
						<Grid size={{ xs: 12, md: 7 }}>
							<TextField
								required
								label="Job title"
								value={form.title}
								onChange={(event) => onChange("title", event.target.value)}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 5 }}>
							<TextField
								required
								label="Organization"
								value={form.organization_name}
								onChange={(event) =>
									onChange("organization_name", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, sm: 6 }}>
							<TextField
								select
								required
								label="Job type"
								value={form.job_type}
								onChange={(event) => onChange("job_type", event.target.value)}
							>
								{jobTypeOptions.map(([value, label]) => (
									<MenuItem key={value} value={value}>
										{label}
									</MenuItem>
								))}
							</TextField>
						</Grid>
						<Grid size={{ xs: 12, sm: 6 }}>
							<TextField
								required
								label="Location"
								value={form.location}
								onChange={(event) => onChange("location", event.target.value)}
							/>
						</Grid>
						<Grid size={{ xs: 12 }}>
							<TextField
								required
								multiline
								minRows={5}
								label="Description"
								value={form.description_markdown}
								onChange={(event) =>
									onChange("description_markdown", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 7 }}>
							<TextField
								label="Apply link"
								type="url"
								value={form.external_url}
								onChange={(event) =>
									onChange("external_url", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 5 }}>
							<TextField
								label="Button label"
								value={form.call_to_action}
								onChange={(event) =>
									onChange("call_to_action", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 4 }}>
							<TextField
								required
								label="Contact name"
								value={form.contact_name}
								onChange={(event) =>
									onChange("contact_name", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 4 }}>
							<TextField
								required
								label="Contact email"
								type="email"
								value={form.contact_email}
								onChange={(event) =>
									onChange("contact_email", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 4 }}>
							<TextField
								label="Contact role"
								value={form.contact_role}
								onChange={(event) =>
									onChange("contact_role", event.target.value)
								}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 7 }}>
							<TextField
								label="Logo URL"
								type="url"
								value={form.logo_url}
								onChange={(event) => onChange("logo_url", event.target.value)}
							/>
						</Grid>
						<Grid size={{ xs: 12, md: 5 }}>
							<TextField
								label="Expires"
								type="date"
								value={form.expires_at}
								onChange={(event) => onChange("expires_at", event.target.value)}
								slotProps={{ inputLabel: { shrink: true } }}
							/>
						</Grid>
					</Grid>
				</DialogContent>
				<DialogActions>
					<Button type="button" variant="text" onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="contained"
						startIcon={<SendOutlinedIcon />}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Submitting..." : "Submit for review"}
					</Button>
				</DialogActions>
			</Box>
		</Dialog>
	);
}

export default function JobPostingsPage(): React.ReactElement {
	const {
		jobs,
		jobRequests,
		isLoading,
		isLoadingRequests,
		error,
		requestsError,
		submitJobRequestAsync,
		isSubmittingJobRequest,
	} = useJobs();
	const { showToast } = useToast();
	const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
	const [jobForm, setJobForm] = useState<JobSubmissionFormState>(emptyJobForm);

	function updateJobForm(field: keyof JobSubmissionFormState, value: string) {
		setJobForm((currentForm) => ({
			...currentForm,
			[field]: value,
		}));
	}

	function closeSubmissionDialog() {
		if (isSubmittingJobRequest) return;
		setIsSubmissionDialogOpen(false);
	}

	async function submitJobRequest(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const payload: JobPostingRequestPayload = {
			title: jobForm.title.trim(),
			organization_name: jobForm.organization_name.trim(),
			logo_url: getOptionalValue(jobForm.logo_url),
			description_markdown: jobForm.description_markdown.trim(),
			call_to_action: getOptionalValue(jobForm.call_to_action),
			job_type: jobForm.job_type,
			location: jobForm.location.trim(),
			contact_name: jobForm.contact_name.trim(),
			contact_email: jobForm.contact_email.trim(),
			contact_role: getOptionalValue(jobForm.contact_role),
			external_url: getOptionalValue(jobForm.external_url),
			expires_at: getOptionalValue(jobForm.expires_at),
		};

		try {
			await submitJobRequestAsync(payload);
			showToast("Job submitted for admin review.", "success");
			setJobForm(emptyJobForm);
			setIsSubmissionDialogOpen(false);
		} catch (submitError) {
			const message =
				submitError instanceof Error ? submitError.message : "Unknown error";
			showToast(`Could not submit job: ${message}`, "error");
		}
	}

	return (
		<ToolPageShell
			title="Job Board"
			description="Approved opportunities for active TUM.ai members."
			maxWidth={1120}
		>
			<Stack spacing={3}>
				{requestsError && (
					<Alert severity="warning">
						{requestsError instanceof Error
							? requestsError.message
							: "Could not load job submissions."}
					</Alert>
				)}
				{isLoadingRequests ? (
					<Stack direction="row" spacing={1.5} alignItems="center">
						<CircularProgress size={22} />
						<Typography color="text.secondary">
							Loading job submissions...
						</Typography>
					</Stack>
				) : (
					<JobSubmissionPanel
						requests={jobRequests}
						onOpenForm={() => setIsSubmissionDialogOpen(true)}
					/>
				)}

				{isLoading ? (
					<Stack direction="row" spacing={1.5} alignItems="center">
						<CircularProgress size={22} />
						<Typography color="text.secondary">
							Loading job postings...
						</Typography>
					</Stack>
				) : error ? (
					<Alert severity="error">
						{error instanceof Error
							? error.message
							: "Could not load job postings."}
					</Alert>
				) : jobs.length === 0 ? (
					<GlassCard>
						<CardContent sx={{ p: { xs: 3, md: 4 } }}>
							<Stack spacing={1.5} alignItems="flex-start">
								<WorkOutlineIcon color="primary" />
								<Typography variant="h5">No job postings right now</Typography>
								<Typography color="text.secondary">
									Approved opportunities will appear here.
								</Typography>
							</Stack>
						</CardContent>
					</GlassCard>
				) : (
					<Grid container spacing={2.5}>
						{jobs.map((job) => (
							<Grid key={job.id} size={{ xs: 12, md: 6 }}>
								<JobCard job={job} />
							</Grid>
						))}
					</Grid>
				)}
			</Stack>
			<JobSubmissionDialog
				open={isSubmissionDialogOpen}
				form={jobForm}
				isSubmitting={isSubmittingJobRequest}
				onClose={closeSubmissionDialog}
				onChange={updateJobForm}
				onSubmit={submitJobRequest}
			/>
		</ToolPageShell>
	);
}
