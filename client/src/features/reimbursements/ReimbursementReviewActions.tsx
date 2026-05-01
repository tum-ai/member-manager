import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaidIcon from "@mui/icons-material/Paid";
import { Button, Stack, TextField } from "@mui/material";
import type React from "react";
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

export default function ReimbursementReviewActions({
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

	if (!canApprove && !canMarkPaid) return null;

	if (canApprove) {
		return (
			<Stack spacing={1.25} sx={{ mt: compact ? 0 : 1 }}>
				<TextField
					label="Rejection reason"
					value={rejectionReason}
					onChange={(event) => onReasonChange(event.target.value)}
					size="small"
					placeholder="Required only when rejecting"
				/>
				<Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
					<Button
						variant="contained"
						startIcon={<CheckCircleIcon />}
						disabled={isReviewing}
						onClick={() => onReview("approve")}
						size={compact ? "small" : "medium"}
					>
						Approve
					</Button>
					<Button
						variant="outlined"
						color="error"
						disabled={isReviewing || rejectionReason.trim() === ""}
						onClick={() => onReview("reject")}
						size={compact ? "small" : "medium"}
					>
						Reject
					</Button>
				</Stack>
			</Stack>
		);
	}

	return (
		<Button
			variant="contained"
			startIcon={<PaidIcon />}
			disabled={isReviewing}
			onClick={() => onReview("mark_paid")}
			size={compact ? "small" : "medium"}
		>
			Mark paid
		</Button>
	);
}
