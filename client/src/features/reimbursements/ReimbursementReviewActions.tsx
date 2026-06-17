import { Ban, CircleCheck, HandCoins } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/ui/info-box";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
	ReimbursementRequest,
	ReimbursementReviewAction,
} from "../../hooks/useReimbursementRequests";

interface ReimbursementReviewActionsProps {
	request: ReimbursementRequest;
	isReviewing: boolean;
	rejectionReason: string;
	onReasonChange: (reason: string) => void;
	onReview: (action: ReimbursementReviewAction) => Promise<void>;
	compact?: boolean;
}

export function ReimbursementReviewActions({
	request,
	isReviewing,
	rejectionReason,
	onReasonChange,
	onReview,
	compact = false,
}: ReimbursementReviewActionsProps): React.ReactElement | null {
	const canApprove = request.approval_status === "pending";
	const canMarkPaid =
		request.approval_status === "approved" && request.payment_status !== "paid";
	const availableActions: ReimbursementReviewAction[] = canApprove
		? ["approve", "reject"]
		: canMarkPaid
			? ["mark_paid"]
			: [];
	const [isRejecting, setIsRejecting] = useState(false);

	// Collapse an open reject panel when the underlying request (and therefore
	// its available actions) changes, so we never leave a stale panel open.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset effect keyed on the request's first available action
	useEffect(() => {
		setIsRejecting(false);
	}, [availableActions[0]]);

	if (!canApprove && !canMarkPaid) return null;

	const buttonSize = compact ? "sm" : "default";

	return (
		<div
			className={cn(
				"flex flex-col gap-2.5",
				compact ? "mt-0 max-w-[260px]" : "mt-2 max-w-[420px]",
			)}
		>
			<div className="flex flex-row flex-wrap gap-2">
				{availableActions.includes("approve") && (
					<Button
						size={buttonSize}
						disabled={isReviewing}
						onClick={() => onReview("approve")}
					>
						<CircleCheck className="size-4" />
						Approve
					</Button>
				)}
				{availableActions.includes("mark_paid") && (
					<Button
						size={buttonSize}
						disabled={isReviewing}
						onClick={() => onReview("mark_paid")}
					>
						<HandCoins className="size-4" />
						Mark paid
					</Button>
				)}
				{availableActions.includes("reject") && !isRejecting && (
					<Button
						variant="outline"
						size={buttonSize}
						disabled={isReviewing}
						onClick={() => setIsRejecting(true)}
						className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
					>
						<Ban className="size-4" />
						Reject
					</Button>
				)}
			</div>
			{isRejecting && (
				<InfoBox variant="destructive" className="flex flex-col gap-2.5">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={`rejection-reason-${request.id}`}>
							Rejection reason
						</Label>
						<Textarea
							id={`rejection-reason-${request.id}`}
							value={rejectionReason}
							onChange={(event) => onReasonChange(event.target.value)}
							placeholder="Required for rejection"
							rows={2}
						/>
					</div>
					<div className="flex flex-row flex-wrap gap-2">
						<Button
							variant="destructive"
							size={buttonSize}
							disabled={isReviewing || rejectionReason.trim() === ""}
							onClick={() => onReview("reject")}
						>
							<Ban className="size-4" />
							Confirm rejection
						</Button>
						<Button
							variant="ghost"
							size={buttonSize}
							disabled={isReviewing}
							onClick={() => {
								setIsRejecting(false);
								onReasonChange("");
							}}
						>
							Cancel
						</Button>
					</div>
				</InfoBox>
			)}
		</div>
	);
}
