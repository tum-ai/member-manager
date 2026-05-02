import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaidIcon from "@mui/icons-material/Paid";
import {
	Button,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
} from "@mui/material";
import type React from "react";
import { useEffect, useState } from "react";
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
	const availableActions: ReimbursementReviewAction[] = canApprove
		? ["approve", "reject"]
		: canMarkPaid
			? ["mark_paid"]
			: [];
	const [selectedAction, setSelectedAction] = useState<
		ReimbursementReviewAction | ""
	>(availableActions[0] ?? "");

	useEffect(() => {
		setSelectedAction(availableActions[0] ?? "");
	}, [availableActions[0]]);

	if (!canApprove && !canMarkPaid) return null;

	const actionIcon =
		selectedAction === "mark_paid" ? <PaidIcon /> : <CheckCircleIcon />;
	const actionDisabled =
		isReviewing ||
		!selectedAction ||
		(selectedAction === "reject" && rejectionReason.trim() === "");

	return (
		<Stack
			spacing={1.25}
			sx={{
				mt: compact ? 0 : 1,
				maxWidth: compact ? 260 : 420,
			}}
		>
			<FormControl size="small" fullWidth>
				<InputLabel id={`review-action-${request.id}`}>Action</InputLabel>
				<Select
					labelId={`review-action-${request.id}`}
					label="Action"
					value={selectedAction}
					onChange={(event) =>
						setSelectedAction(event.target.value as ReimbursementReviewAction)
					}
				>
					{availableActions.includes("approve") && (
						<MenuItem value="approve">Approve</MenuItem>
					)}
					{availableActions.includes("reject") && (
						<MenuItem value="reject">Reject</MenuItem>
					)}
					{availableActions.includes("mark_paid") && (
						<MenuItem value="mark_paid">Mark paid</MenuItem>
					)}
				</Select>
			</FormControl>
			{selectedAction === "reject" && (
				<TextField
					label="Rejection reason"
					value={rejectionReason}
					onChange={(event) => onReasonChange(event.target.value)}
					size="small"
					placeholder="Required for rejection"
					multiline
					minRows={2}
				/>
			)}
			<Button
				variant="contained"
				startIcon={actionIcon}
				disabled={actionDisabled}
				onClick={() => selectedAction && onReview(selectedAction)}
				size={compact ? "small" : "medium"}
			>
				Apply action
			</Button>
		</Stack>
	);
}
