import type React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import {
	JobGridSection,
	JobPostingsGridSkeleton,
} from "./components/JobGridSection";
import {
	JobSubmissionDialog,
	JobSubmissionPanel,
	JobSubmissionPanelSkeleton,
} from "./components/JobSubmissionSection";
import { useJobPostings } from "./hooks/useJobPostings";

export default function JobPostingsPage(): React.ReactElement {
	const {
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
	} = useJobPostings();

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
						onOpenForm={openSubmissionDialog}
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
				) : (
					<JobGridSection jobs={jobs} />
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
