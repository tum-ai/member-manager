import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/contexts/ToastContext";
import { useAdminData } from "@/hooks/useAdminData";
import { AdminRequestsLayout } from "./AdminRequestsLayout";
import {
	CertificateDetailRow,
	formatCertificateLeadership,
	getMemberDisplayName,
} from "./adminRequests";
import type { EngagementCertificateRequest } from "./adminTypes";

export default function AdminCertificateRequestsPage() {
	const { showToast } = useToast();
	const {
		members,
		certificateRequests,
		isLoading,
		error,
		reviewCertificateRequestAsync,
		isReviewingCertificateRequest,
	} = useAdminData();
	const [requestBeingViewed, setRequestBeingViewed] =
		useState<EngagementCertificateRequest | null>(null);

	const allMembers = members ?? [];
	const pending = certificateRequests.filter(
		(request) => request.status === "pending",
	);

	async function reviewCertificateRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		try {
			await reviewCertificateRequestAsync({ requestId, decision });
			showToast(`Certificate request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(
				`Failed to review certificate request: ${errorMessage}`,
				"error",
			);
		}
	}

	return (
		<AdminRequestsLayout
			title="Engagement Certificate Requests"
			description="Review engagement details and approve certificate requests."
			isLoading={isLoading}
			error={error}
		>
			{pending.length === 0 ? (
				<GlassCard className="p-6">
					<p className="text-muted-foreground">
						No pending engagement certificate requests.
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
									Engagement certificate request for {memberName}
								</p>
								<p className="text-sm text-muted-foreground">
									Member: {memberName}
								</p>
								<p className="mt-2 text-sm">
									Submitted engagements: {request.engagements.length}
								</p>
								<div className="mt-auto flex flex-row gap-3 pt-4">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setRequestBeingViewed(request)}
										aria-label={`View engagement certificate details for ${memberName}`}
									>
										View details
									</Button>
									<Button
										type="button"
										size="sm"
										onClick={() =>
											reviewCertificateRequest(request.id, "approved")
										}
										disabled={isReviewingCertificateRequest}
										aria-label={`Approve engagement certificate request for ${memberName}`}
									>
										Approve
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											reviewCertificateRequest(request.id, "rejected")
										}
										disabled={isReviewingCertificateRequest}
										aria-label={`Reject engagement certificate request for ${memberName}`}
									>
										Reject
									</Button>
								</div>
							</GlassCard>
						);
					})}
				</div>
			)}

			<Dialog
				open={Boolean(requestBeingViewed)}
				onOpenChange={(open) => {
					if (!open) setRequestBeingViewed(null);
				}}
			>
				<DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{requestBeingViewed
								? `Engagement certificate request for ${getMemberDisplayName(
										allMembers,
										requestBeingViewed.user_id,
									)}`
								: "Engagement certificate request"}
						</DialogTitle>
						<DialogDescription className="sr-only">
							Review the submitted engagement details before approving or
							rejecting the certificate request.
						</DialogDescription>
					</DialogHeader>
					<div
						data-testid="certificate-request-engagements"
						className="scrollbar-thin flex min-h-0 flex-col gap-4 overflow-y-auto border-y py-4 pr-2"
					>
						{requestBeingViewed?.engagements.map((engagement, index) => (
							<div key={String(engagement.id ?? index)}>
								<p className="mb-1 font-bold">Engagement {index + 1}</p>
								<div className="flex flex-col gap-2">
									<CertificateDetailRow
										label="Start Date"
										value={engagement.startDate}
									/>
									<CertificateDetailRow
										label="End Date"
										value={
											engagement.isStillActive === true
												? "Still active"
												: engagement.endDate
										}
									/>
									<CertificateDetailRow
										label="Weekly Hours"
										value={
											typeof engagement.weeklyHours === "string" &&
											engagement.weeklyHours.trim()
												? `${engagement.weeklyHours} hours`
												: null
										}
									/>
									<CertificateDetailRow
										label="Department"
										value={engagement.department}
									/>
									<CertificateDetailRow
										label="Leadership"
										value={formatCertificateLeadership(engagement)}
									/>
									<CertificateDetailRow
										label="Tasks / Responsibilities"
										value={engagement.tasksDescription}
										preserveWhitespace
									/>
								</div>
								{index < (requestBeingViewed?.engagements.length ?? 0) - 1 && (
									<Separator className="mt-4" />
								)}
							</div>
						))}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setRequestBeingViewed(null)}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</AdminRequestsLayout>
	);
}
