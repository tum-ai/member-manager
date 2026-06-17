import type { BadgeVariant } from "@/components/ui/badge";
import type { JobPostingRequest, JobType, PartnerJob } from "@/hooks/useJobs";

export const jobTypeLabels: Record<JobType, string> = {
	internship: "Internship",
	working_student: "Working student",
	full_time: "Full-time",
	thesis: "Thesis",
	other: "Other",
};

export const jobTypeOptions = Object.entries(jobTypeLabels) as Array<
	[JobType, string]
>;

export type JobSubmissionFormState = {
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

export const emptyJobForm: JobSubmissionFormState = {
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

export function formatDate(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

export function getOptionalValue(value: string): string | null {
	const trimmed = value.trim();
	return trimmed || null;
}

export function getSafeHttpUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? value : null;
	} catch {
		return null;
	}
}

export function getStatusBadgeVariant(
	status: JobPostingRequest["status"],
): BadgeVariant {
	if (status === "approved") return "success";
	if (status === "rejected") return "danger";
	return "warning";
}

export function getApplyHref(job: PartnerJob): string {
	return getSafeHttpUrl(job.external_url) ?? `mailto:${job.contact.email}`;
}

export function getApplyLabel(job: PartnerJob): string {
	return (
		job.call_to_action.trim() ||
		(getSafeHttpUrl(job.external_url) ? "Open posting" : "Contact")
	);
}
