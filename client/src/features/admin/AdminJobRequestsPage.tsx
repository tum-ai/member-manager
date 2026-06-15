import { Briefcase, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/ui/GlassCard";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "../../contexts/ToastContext";
import { useAdminData } from "../../hooks/useAdminData";
import AdminRequestsLayout from "./AdminRequestsLayout";
import {
	adminJobTypeLabels,
	getMemberDisplayName,
	getSafeHttpUrl,
} from "./adminRequests";

export default function AdminJobRequestsPage() {
	const { showToast } = useToast();
	const {
		members,
		jobRequests,
		isLoading,
		error,
		reviewJobRequestAsync,
		isReviewingJobRequest,
	} = useAdminData();

	const allMembers = members ?? [];
	const pending = jobRequests.filter((request) => request.status === "pending");

	async function reviewJobRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		try {
			await reviewJobRequestAsync({ requestId, decision });
			showToast(`Job request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to review job request: ${errorMessage}`, "error");
		}
	}

	return (
		<AdminRequestsLayout
			title="Job Posting Requests"
			description="Review and approve member-submitted job postings."
			isLoading={isLoading}
			error={error}
		>
			{pending.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">
						No pending job posting requests.
					</p>
				</GlassCard>
			) : (
				<div className="grid items-start gap-4 lg:grid-cols-2">
					{pending.map((request) => {
						const memberName = getMemberDisplayName(
							allMembers,
							request.user_id,
						);
						const safeExternalUrl = getSafeHttpUrl(request.external_url);
						return (
							<GlassCard key={request.id} className="flex flex-col p-5">
								<div className="mb-0.5 flex flex-row items-center gap-2">
									<Briefcase className="size-4 text-brand" />
									<p className="font-semibold">{request.title}</p>
								</div>
								<p className="text-sm text-muted-foreground">
									Member: {memberName}
								</p>
								<p className="text-sm text-muted-foreground">
									{request.organization_name} ·{" "}
									{adminJobTypeLabels[request.job_type] ?? request.job_type} ·{" "}
									{request.location}
								</p>
								<p className="text-sm text-muted-foreground">
									Contact: {request.contact_name} ({request.contact_email})
								</p>
								<Markdown className="mt-2">
									{request.description_markdown}
								</Markdown>
								<div className="mt-auto flex flex-row flex-wrap gap-3 pt-4">
									{safeExternalUrl && (
										<Button variant="ghost" size="sm" asChild>
											<a
												href={safeExternalUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												Open posting
												<ExternalLink className="size-4" />
											</a>
										</Button>
									)}
									<Button
										type="button"
										size="sm"
										onClick={() => reviewJobRequest(request.id, "approved")}
										disabled={isReviewingJobRequest}
										aria-label={`Approve job posting request for ${memberName}`}
									>
										Approve
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => reviewJobRequest(request.id, "rejected")}
										disabled={isReviewingJobRequest}
										aria-label={`Reject job posting request for ${memberName}`}
									>
										Reject
									</Button>
								</div>
							</GlassCard>
						);
					})}
				</div>
			)}
		</AdminRequestsLayout>
	);
}
