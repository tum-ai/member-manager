import type React from "react";
import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import {
	emptyJobForm,
	getOptionalValue,
	type JobSubmissionFormState,
} from "@/features/jobs/jobPostingsUtils";
import { type JobPostingRequestPayload, useJobs } from "@/hooks/useJobs";

export function useJobPostings() {
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

	function openSubmissionDialog() {
		setIsSubmissionDialogOpen(true);
	}

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

	return {
		jobs,
		jobRequests,
		isLoading,
		isLoadingRequests,
		error,
		requestsError,
		isSubmittingJobRequest,
		isSubmissionDialogOpen,
		jobForm,
		openSubmissionDialog,
		updateJobForm,
		closeSubmissionDialog,
		submitJobRequest,
	};
}
