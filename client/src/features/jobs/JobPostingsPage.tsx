import {
	Briefcase,
	Building2,
	ExternalLink,
	Mail,
	MapPin,
	Plus,
	Send,
} from "lucide-react";
import type React from "react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import GlassCard from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/ui/markdown";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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

function getStatusBadgeVariant(
	status: JobPostingRequest["status"],
): BadgeVariant {
	if (status === "approved") return "success";
	if (status === "rejected") return "danger";
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

function JobApplyButton({
	job,
	className,
}: {
	job: PartnerJob;
	className?: string;
}): React.ReactElement {
	const safeExternalUrl = getSafeHttpUrl(job.external_url);
	return (
		<Button
			asChild
			className={className}
			onClick={(event) => event.stopPropagation()}
		>
			<a
				href={getApplyHref(job)}
				target={safeExternalUrl ? "_blank" : undefined}
				rel={safeExternalUrl ? "noopener noreferrer" : undefined}
			>
				{getApplyLabel(job)}
				{safeExternalUrl ? (
					<ExternalLink className="size-4" />
				) : (
					<Mail className="size-4" />
				)}
			</a>
		</Button>
	);
}

function JobCardHeader({ job }: { job: PartnerJob }): React.ReactElement {
	const logoUrl = job.logo_url ?? job.partner.logo_url;
	return (
		<div className="flex items-start gap-4">
			<Avatar size="lg" className="size-[52px] rounded-md bg-brand/10">
				<AvatarImage src={logoUrl ?? undefined} alt={job.partner.name} />
				<AvatarFallback className="rounded-md bg-brand/10 text-brand">
					<Building2 className="size-5" />
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<h2 className="mb-0.5 text-xl font-semibold">{job.title}</h2>
				<p className="text-muted-foreground">{job.partner.name}</p>
			</div>
		</div>
	);
}

function JobBadges({ job }: { job: PartnerJob }): React.ReactElement {
	return (
		<div className="flex flex-wrap gap-2">
			<Badge variant="secondary">{jobTypeLabels[job.job_type]}</Badge>
			<Badge variant="outline" className="gap-1 text-muted-foreground">
				<MapPin className="size-3.5" />
				{job.location}
			</Badge>
		</div>
	);
}

function JobMeta({ job }: { job: PartnerJob }): React.ReactElement {
	return (
		<div>
			<p className="text-sm text-muted-foreground">
				Published {formatDate(job.published_at)}
			</p>
			<p className="text-sm text-muted-foreground">
				Contact: {job.contact.name}
				{job.contact.role ? `, ${job.contact.role}` : ""}
			</p>
		</div>
	);
}

function JobDetailDialog({
	job,
	open,
	onOpenChange,
}: {
	job: PartnerJob;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}): React.ReactElement {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<JobCardHeader job={job} />
				</DialogHeader>
				<JobBadges job={job} />
				<Markdown className="text-muted-foreground">
					{job.description_markdown}
				</Markdown>
				<Separator />
				<div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
					<JobMeta job={job} />
					<JobApplyButton job={job} className="self-stretch sm:self-center" />
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function JobCard({ job }: { job: PartnerJob }): React.ReactElement {
	const [detailOpen, setDetailOpen] = useState(false);

	return (
		<>
			<GlassCard
				variant="interactive"
				className="h-full"
				onClick={() => setDetailOpen(true)}
				role="button"
				tabIndex={0}
				aria-label={`View details for ${job.title}`}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						setDetailOpen(true);
					}
				}}
			>
				<div className="flex h-full flex-col gap-5 p-5 md:p-6">
					<JobCardHeader job={job} />
					<JobBadges job={job} />

					<div className="relative">
						<Markdown clampHeight="7.5rem" className="text-muted-foreground">
							{job.description_markdown}
						</Markdown>
						<span className="mt-1 inline-block text-sm font-medium text-brand">
							Read more
						</span>
					</div>

					<div className="flex-1" />
					<Separator />

					<div className="flex flex-col items-stretch justify-between gap-1.5 sm:flex-row sm:items-center">
						<JobMeta job={job} />
						<JobApplyButton job={job} className="self-stretch sm:self-center" />
					</div>
				</div>
			</GlassCard>
			<JobDetailDialog
				job={job}
				open={detailOpen}
				onOpenChange={setDetailOpen}
			/>
		</>
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
			<div className="p-5 md:p-6">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<h2 className="text-xl font-semibold">Member job submissions</h2>
						<p className="mt-0.5 text-muted-foreground">
							Approved member postings are published on the board.
						</p>
					</div>
					<Button type="button" onClick={onOpenForm}>
						<Plus className="size-4" />
						Post job
					</Button>
				</div>

				<Separator className="my-5" />

				{requests.length === 0 ? (
					<p className="text-muted-foreground">No submitted jobs yet.</p>
				) : (
					<div className="flex flex-col gap-3">
						{requests.map((request) => (
							<div
								key={request.id}
								className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
							>
								<div className="min-w-0">
									<p className="font-bold">{request.title}</p>
									<p className="text-sm text-muted-foreground">
										{request.organization_name} ·{" "}
										{jobTypeLabels[request.job_type]} · {request.location}
									</p>
								</div>
								<Badge
									variant={getStatusBadgeVariant(request.status)}
									className="capitalize"
								>
									{request.status}
								</Badge>
							</div>
						))}
					</div>
				)}
			</div>
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
	const fieldId = useId();
	const id = (name: string) => `${fieldId}-${name}`;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent className="sm:max-w-2xl">
				<form onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Post a job</DialogTitle>
					</DialogHeader>
					<div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-12">
						<div className="flex flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("title")}>Job title</Label>
							<Input
								id={id("title")}
								required
								value={form.title}
								onChange={(event) => onChange("title", event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("organization")}>Organization</Label>
							<Input
								id={id("organization")}
								required
								value={form.organization_name}
								onChange={(event) =>
									onChange("organization_name", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 sm:col-span-6">
							<Label htmlFor={id("job_type")}>Job type</Label>
							<Select
								value={form.job_type}
								onValueChange={(value) => onChange("job_type", value)}
							>
								<SelectTrigger
									id={id("job_type")}
									className="w-full"
									aria-label="Job type"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{jobTypeOptions.map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1.5 sm:col-span-6">
							<Label htmlFor={id("location")}>Location</Label>
							<Input
								id={id("location")}
								required
								value={form.location}
								onChange={(event) => onChange("location", event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-12">
							<Label htmlFor={id("description")}>Description</Label>
							<Textarea
								id={id("description")}
								required
								rows={5}
								value={form.description_markdown}
								onChange={(event) =>
									onChange("description_markdown", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("external_url")}>Apply link</Label>
							<Input
								id={id("external_url")}
								type="url"
								value={form.external_url}
								onChange={(event) =>
									onChange("external_url", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("call_to_action")}>Button label</Label>
							<Input
								id={id("call_to_action")}
								value={form.call_to_action}
								onChange={(event) =>
									onChange("call_to_action", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_name")}>Contact name</Label>
							<Input
								id={id("contact_name")}
								required
								value={form.contact_name}
								onChange={(event) =>
									onChange("contact_name", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_email")}>Contact email</Label>
							<Input
								id={id("contact_email")}
								required
								type="email"
								value={form.contact_email}
								onChange={(event) =>
									onChange("contact_email", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-4">
							<Label htmlFor={id("contact_role")}>Contact role</Label>
							<Input
								id={id("contact_role")}
								value={form.contact_role}
								onChange={(event) =>
									onChange("contact_role", event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-7">
							<Label htmlFor={id("logo_url")}>Logo URL</Label>
							<Input
								id={id("logo_url")}
								type="url"
								value={form.logo_url}
								onChange={(event) => onChange("logo_url", event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1.5 md:col-span-5">
							<Label htmlFor={id("expires_at")}>Expires</Label>
							<Input
								id={id("expires_at")}
								type="date"
								value={form.expires_at}
								onChange={(event) => onChange("expires_at", event.target.value)}
							/>
						</div>
					</div>
					<DialogFooter className="mt-6">
						<Button type="button" variant="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Send className="size-4" />
							{isSubmitting ? "Submitting..." : "Submit for review"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
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
		>
			<div className="flex flex-col gap-6">
				{requestsError && (
					<Alert>
						<AlertDescription>
							{requestsError instanceof Error
								? requestsError.message
								: "Could not load job submissions."}
						</AlertDescription>
					</Alert>
				)}
				{isLoadingRequests ? (
					<JobSubmissionPanelSkeleton />
				) : (
					<JobSubmissionPanel
						requests={jobRequests}
						onOpenForm={() => setIsSubmissionDialogOpen(true)}
					/>
				)}

				{isLoading ? (
					<JobPostingsGridSkeleton />
				) : error ? (
					<Alert variant="destructive">
						<AlertDescription>
							{error instanceof Error
								? error.message
								: "Could not load job postings."}
						</AlertDescription>
					</Alert>
				) : jobs.length === 0 ? (
					<GlassCard>
						<div className="p-6 md:p-8">
							<div className="flex flex-col items-start gap-3">
								<Briefcase className="size-6 text-brand" />
								<h2 className="text-xl font-semibold">
									No job postings right now
								</h2>
								<p className="text-muted-foreground">
									Approved opportunities will appear here.
								</p>
							</div>
						</div>
					</GlassCard>
				) : (
					<div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2")}>
						{jobs.map((job) => (
							<JobCard key={job.id} job={job} />
						))}
					</div>
				)}
			</div>
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

function JobSubmissionPanelSkeleton(): React.ReactElement {
	return (
		<SkeletonRegion label="Loading job submissions">
			<GlassCard variant="elevated">
				<div className="p-5 md:p-6">
					<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
						<div className="space-y-1.5">
							<Skeleton className="h-6 w-56" />
							<Skeleton className="h-4 w-72 max-w-full" />
						</div>
						<Skeleton className="h-9 w-28 rounded-md" />
					</div>
					<Separator className="my-5" />
					<div className="flex flex-col gap-3">
						{Array.from({ length: 3 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<div key={i} className="flex items-center justify-between gap-3">
								<div className="min-w-0 flex-1 space-y-1.5">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-3 w-56 max-w-full" />
								</div>
								<Skeleton className="h-5 w-20 rounded-full" />
							</div>
						))}
					</div>
				</div>
			</GlassCard>
		</SkeletonRegion>
	);
}

function JobPostingsGridSkeleton(): React.ReactElement {
	return (
		<SkeletonRegion
			label="Loading job postings"
			className="grid grid-cols-1 gap-5 md:grid-cols-2"
		>
			{Array.from({ length: 4 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<GlassCard key={i} className="h-full">
					<div className="flex h-full flex-col gap-5 p-5 md:p-6">
						<div className="flex items-start gap-4">
							<Skeleton className="size-[52px] shrink-0 rounded-md" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-6 w-3/4" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						</div>
						<div className="flex gap-1.5">
							<Skeleton className="h-5 w-20 rounded-full" />
							<Skeleton className="h-5 w-24 rounded-full" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
						<Separator />
						<div className="flex items-center justify-between gap-3">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-9 w-24 rounded-md" />
						</div>
					</div>
				</GlassCard>
			))}
		</SkeletonRegion>
	);
}
