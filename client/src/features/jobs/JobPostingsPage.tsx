import {
	Business as BusinessIcon,
	EmailOutlined as EmailOutlinedIcon,
	LocationOnOutlined as LocationOnOutlinedIcon,
	OpenInNew as OpenInNewIcon,
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
	Divider,
	Grid,
	Stack,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type React from "react";
import GlassCard from "../../components/ui/GlassCard";
import { type JobType, type PartnerJob, useJobs } from "../../hooks/useJobs";
import ToolPageShell from "../tools/ToolPageShell";

const jobTypeLabels: Record<JobType, string> = {
	internship: "Internship",
	working_student: "Working student",
	full_time: "Full-time",
	thesis: "Thesis",
	other: "Other",
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

function getApplyHref(job: PartnerJob): string {
	return job.external_url ?? `mailto:${job.contact.email}`;
}

function getApplyLabel(job: PartnerJob): string {
	return (
		job.call_to_action.trim() || (job.external_url ? "Open posting" : "Contact")
	);
}

function JobCard({ job }: { job: PartnerJob }): React.ReactElement {
	const theme = useTheme();
	const logoUrl = job.logo_url ?? job.partner.logo_url;
	const applyHref = getApplyHref(job);
	const applyLabel = getApplyLabel(job);

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
						target={job.external_url ? "_blank" : undefined}
						rel={job.external_url ? "noopener noreferrer" : undefined}
						variant="contained"
						endIcon={
							job.external_url ? <OpenInNewIcon /> : <EmailOutlinedIcon />
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

export default function JobPostingsPage(): React.ReactElement {
	const { jobs, isLoading, error } = useJobs();

	return (
		<ToolPageShell
			title="Job Board"
			description="Approved partner postings for active TUM.ai members."
			maxWidth={1120}
		>
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
								Approved partner opportunities will appear here.
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
		</ToolPageShell>
	);
}
