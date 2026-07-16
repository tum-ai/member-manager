import type {
	JobPostingFormInput,
	JobPostingRequest,
} from "@member-manager/shared";

export const emptyAdminJobForm: JobPostingFormInput = {
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

function toDateInputValue(value?: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

export function jobRequestToForm(
	request: JobPostingRequest,
): JobPostingFormInput {
	return {
		title: request.title,
		organization_name: request.organization_name,
		logo_url: request.logo_url ?? "",
		description_markdown: request.description_markdown,
		call_to_action: request.call_to_action ?? "Apply now",
		job_type: request.job_type,
		location: request.location,
		contact_name: request.contact_name,
		contact_email: request.contact_email,
		contact_role: request.contact_role ?? "",
		external_url: request.external_url ?? "",
		expires_at: toDateInputValue(request.expires_at),
	};
}
