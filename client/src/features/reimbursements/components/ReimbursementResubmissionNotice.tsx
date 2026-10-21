import type { ReactElement } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatReviewDate } from "@/features/reimbursements/reimbursementReviewUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";

function getResubmissionCount(request: ReimbursementRequest): number {
	return request.resubmission_count ?? 0;
}

/** Badge in the queue row for requests the member fixed after a rejection. */
export function ResubmittedBadge({
	request,
}: {
	request: ReimbursementRequest;
}): ReactElement | null {
	const count = getResubmissionCount(request);
	if (count === 0) return null;
	return (
		<Badge variant="info">
			{count === 1 ? "Resubmitted" : `Resubmitted ×${count}`}
		</Badge>
	);
}

/**
 * Shows reviewers the rejection the member addressed with their last
 * resubmission, so they can check it was actually fixed.
 */
export function ResubmissionNotice({
	request,
}: {
	request: ReimbursementRequest;
}): ReactElement | null {
	const count = getResubmissionCount(request);
	if (count === 0) return null;
	return (
		<Alert>
			<AlertTitle>
				Resubmitted after a rejection
				{request.resubmitted_at
					? ` · ${formatReviewDate(request.resubmitted_at)}`
					: ""}
			</AlertTitle>
			<AlertDescription className="break-words whitespace-pre-wrap">
				Previously rejected:{" "}
				{request.last_rejection_reason || "No reason given"}
			</AlertDescription>
		</Alert>
	);
}
