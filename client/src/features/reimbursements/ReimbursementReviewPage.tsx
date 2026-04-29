import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaidIcon from "@mui/icons-material/Paid";
import {
	Alert,
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import type React from "react";
import { useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import {
	type ReimbursementRequest,
	useReimbursementReview,
} from "../../hooks/useReimbursementRequests";
import ToolPageShell from "../tools/ToolPageShell";

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

function formatAmount(value: number): string {
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: "EUR",
	}).format(Number(value));
}

function getReviewStage(request: ReimbursementRequest): string {
	if (request.status === "paid" || request.payment_status === "paid") {
		return "Paid";
	}
	if (request.approval_status === "not_approved") {
		return "Rejected";
	}
	if (request.approval_status === "approved") {
		return "Ready for payment";
	}
	return "Needs approval";
}

export default function ReimbursementReviewPage(): React.ReactElement {
	const { showToast } = useToast();
	const { requests, isLoading, error, reviewRequestAsync, isReviewing } =
		useReimbursementReview();
	const [rejectionReasons, setRejectionReasons] = useState<
		Record<string, string>
	>({});

	const handleReview = async (
		requestId: string,
		action: "approve" | "reject" | "mark_paid",
	): Promise<void> => {
		try {
			await reviewRequestAsync({
				requestId,
				action,
				rejection_reason:
					action === "reject" ? rejectionReasons[requestId] : undefined,
			});
			showToast("Reimbursement request updated.", "success");
		} catch (reviewError) {
			showToast(
				`Could not update reimbursement request: ${getErrorMessage(reviewError)}`,
				"error",
			);
		}
	};

	const pendingRequests = requests.filter(
		(request) => request.approval_status === "pending",
	);
	const paymentRequests = requests.filter(
		(request) =>
			request.approval_status === "approved" &&
			request.payment_status !== "paid",
	);
	const closedRequests = requests.filter(
		(request) =>
			request.payment_status === "paid" ||
			request.approval_status === "not_approved",
	);

	return (
		<ToolPageShell
			title="Finance Review"
			description="Review reimbursement and invoice requests, then mark approved requests as paid."
		>
			{isLoading && (
				<Stack direction="row" spacing={1.5} alignItems="center">
					<CircularProgress size={22} />
					<Typography color="text.secondary">
						Loading reimbursement queue...
					</Typography>
				</Stack>
			)}

			{error && (
				<Alert severity="error">
					Legal & Finance members and admins can access this review queue.
				</Alert>
			)}

			{!isLoading && !error && (
				<Box sx={{ display: "grid", gap: 3 }}>
					<ReviewSection
						title="Needs approval"
						requests={pendingRequests}
						emptyText="No requests need approval."
						isReviewing={isReviewing}
						rejectionReasons={rejectionReasons}
						onReasonChange={(requestId, reason) =>
							setRejectionReasons((current) => ({
								...current,
								[requestId]: reason,
							}))
						}
						onReview={handleReview}
					/>
					<ReviewSection
						title="Ready for payment"
						requests={paymentRequests}
						emptyText="No approved requests are waiting for payment."
						isReviewing={isReviewing}
						rejectionReasons={rejectionReasons}
						onReasonChange={(requestId, reason) =>
							setRejectionReasons((current) => ({
								...current,
								[requestId]: reason,
							}))
						}
						onReview={handleReview}
					/>
					<ReviewSection
						title="Closed"
						requests={closedRequests}
						emptyText="No closed requests yet."
						isReviewing={isReviewing}
						rejectionReasons={rejectionReasons}
						onReasonChange={(requestId, reason) =>
							setRejectionReasons((current) => ({
								...current,
								[requestId]: reason,
							}))
						}
						onReview={handleReview}
					/>
				</Box>
			)}
		</ToolPageShell>
	);
}

interface ReviewSectionProps {
	title: string;
	requests: ReimbursementRequest[];
	emptyText: string;
	isReviewing: boolean;
	rejectionReasons: Record<string, string>;
	onReasonChange: (requestId: string, reason: string) => void;
	onReview: (
		requestId: string,
		action: "approve" | "reject" | "mark_paid",
	) => Promise<void>;
}

function ReviewSection({
	title,
	requests,
	emptyText,
	isReviewing,
	rejectionReasons,
	onReasonChange,
	onReview,
}: ReviewSectionProps): React.ReactElement {
	return (
		<Box component="section" aria-labelledby={`${title}-heading`}>
			<Typography id={`${title}-heading`} variant="h5" sx={{ mb: 1.5 }}>
				{title}
			</Typography>
			{requests.length === 0 ? (
				<Alert severity="info">{emptyText}</Alert>
			) : (
				<Box sx={{ display: "grid", gap: 1.5 }}>
					{requests.map((request) => (
						<ReviewCard
							key={request.id}
							request={request}
							isReviewing={isReviewing}
							rejectionReason={rejectionReasons[request.id] ?? ""}
							onReasonChange={(reason) => onReasonChange(request.id, reason)}
							onReview={(action) => onReview(request.id, action)}
						/>
					))}
				</Box>
			)}
		</Box>
	);
}

interface ReviewCardProps {
	request: ReimbursementRequest;
	isReviewing: boolean;
	rejectionReason: string;
	onReasonChange: (reason: string) => void;
	onReview: (action: "approve" | "reject" | "mark_paid") => Promise<void>;
}

function ReviewCard({
	request,
	isReviewing,
	rejectionReason,
	onReasonChange,
	onReview,
}: ReviewCardProps): React.ReactElement {
	const canApprove = request.approval_status === "pending";
	const canMarkPaid =
		request.approval_status === "approved" && request.payment_status !== "paid";

	return (
		<GlassCard>
			<CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					spacing={2}
					justifyContent="space-between"
				>
					<Box sx={{ minWidth: 0 }}>
						<Stack
							direction="row"
							spacing={1}
							alignItems="center"
							sx={{ mb: 1 }}
						>
							<Chip label={getReviewStage(request)} size="small" />
							<Chip
								label={request.department}
								size="small"
								variant="outlined"
							/>
						</Stack>
						<Typography variant="h6" sx={{ mb: 0.5 }}>
							{request.description}
						</Typography>
						<Typography color="text.secondary">
							{request.submission_type === "invoice"
								? "Invoice"
								: "Reimbursement"}{" "}
							· {request.date} · {request.receipt_filename ?? "No file"}
						</Typography>
					</Box>
					<Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
						{formatAmount(request.amount)}
					</Typography>
				</Stack>

				{canApprove && (
					<Stack spacing={1.5} sx={{ mt: 2 }}>
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
							>
								Approve
							</Button>
							<Button
								variant="outlined"
								color="error"
								disabled={isReviewing || rejectionReason.trim() === ""}
								onClick={() => onReview("reject")}
							>
								Reject
							</Button>
						</Stack>
					</Stack>
				)}

				{canMarkPaid && (
					<Button
						variant="contained"
						startIcon={<PaidIcon />}
						disabled={isReviewing}
						onClick={() => onReview("mark_paid")}
						sx={{ mt: 2 }}
					>
						Mark paid
					</Button>
				)}
			</CardContent>
		</GlassCard>
	);
}
