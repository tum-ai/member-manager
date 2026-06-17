import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/contexts/ToastContext";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import { formatRequestedChanges, getMemberDisplayName } from "./adminRequests";

export default function AdminChangeRequestsPage() {
	const { showToast } = useToast();
	const {
		members,
		changeRequests,
		isLoading,
		error,
		reviewChangeRequestAsync,
		isReviewingChangeRequest,
	} = useAdminData();

	const allMembers = members ?? [];
	const pending = changeRequests.filter(
		(request) => request.status === "pending",
	);

	async function reviewChangeRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		try {
			await reviewChangeRequestAsync({ requestId, decision });
			showToast(`Change request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to review request: ${errorMessage}`, "error");
		}
	}

	return (
		<AdminRequestsLayout
			title="Member Change Requests"
			description="Review and approve requested updates to member records."
			isLoading={isLoading}
			error={error}
		>
			{pending.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">
						No pending member change requests.
					</p>
				</GlassCard>
			) : (
				<div className="grid items-start gap-4 lg:grid-cols-2">
					{pending.map((request) => {
						const memberName = getMemberDisplayName(
							allMembers,
							request.user_id,
						);
						return (
							<GlassCard key={request.id} className="flex flex-col p-5">
								<p className="mb-0.5 font-semibold">
									Change request for {memberName}
								</p>
								<p className="text-sm text-muted-foreground">
									Member: {memberName}
								</p>
								{request.reason && (
									<p className="mt-0.5 text-sm text-muted-foreground">
										Reason: {request.reason}
									</p>
								)}
								<p className="mt-2 text-sm">
									Requested changes:{" "}
									{formatRequestedChanges(allMembers, request)}
								</p>
								<div className="mt-auto flex flex-row gap-3 pt-4">
									<Button
										type="button"
										size="sm"
										onClick={() => reviewChangeRequest(request.id, "approved")}
										disabled={isReviewingChangeRequest}
										aria-label={`Approve change request for ${memberName}`}
									>
										Approve
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => reviewChangeRequest(request.id, "rejected")}
										disabled={isReviewingChangeRequest}
										aria-label={`Reject change request for ${memberName}`}
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
