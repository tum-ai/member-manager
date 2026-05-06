import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import type React from "react";
import { useMemo, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import {
	type ReimbursementRequest,
	type ReimbursementReviewAction,
	useReimbursementReview,
} from "../../hooks/useReimbursementRequests";
import ToolPageShell from "../tools/ToolPageShell";
import ReimbursementReviewControls from "./ReimbursementReviewControls";
import ReimbursementReviewQueue from "./ReimbursementReviewQueue";
import {
	ALL_REIMBURSEMENT_REVIEW_FILTER,
	hasReceiptEndpoint,
	matchesReimbursementReviewSearch,
	type ReimbursementReviewApprovalFilter,
	type ReimbursementReviewPaymentFilter,
} from "./reimbursementReviewUtils";

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Unknown error";
}

function getDepartments(requests: ReimbursementRequest[]): string[] {
	return Array.from(new Set(requests.map((request) => request.department)))
		.filter(Boolean)
		.sort((left, right) => left.localeCompare(right));
}

function getQueueStats(requests: ReimbursementRequest[]) {
	return {
		needsApproval: requests.filter(
			(request) => request.approval_status === "pending",
		).length,
		readyForPayment: requests.filter(
			(request) =>
				request.approval_status === "approved" &&
				request.payment_status !== "paid",
		).length,
		closed: requests.filter(
			(request) =>
				request.payment_status === "paid" ||
				request.approval_status === "not_approved",
		).length,
	};
}

function sortRequestsByDateDesc(
	requests: ReimbursementRequest[],
): ReimbursementRequest[] {
	return [...requests].sort((left, right) => {
		const rightTime = new Date(right.created_at ?? right.date ?? "").getTime();
		const leftTime = new Date(left.created_at ?? left.date ?? "").getTime();
		const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
		const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;

		return safeRightTime - safeLeftTime;
	});
}

export default function ReimbursementReviewPage(): React.ReactElement {
	const { showToast } = useToast();
	const {
		requests,
		isLoading,
		error,
		reviewRequestAsync,
		isReviewing,
		canBulkDownloadReceipts,
		bulkDownloadReceiptsAsync,
		isBulkDownloadingReceipts,
		openReceiptAsync,
		downloadReceiptAsync,
		updateDepartmentAsync,
		isUpdatingDepartment,
	} = useReimbursementReview();
	const [search, setSearch] = useState("");
	const [departmentFilter, setDepartmentFilter] = useState(
		ALL_REIMBURSEMENT_REVIEW_FILTER,
	);
	const [approvalFilter, setApprovalFilter] =
		useState<ReimbursementReviewApprovalFilter>(
			ALL_REIMBURSEMENT_REVIEW_FILTER,
		);
	const [paymentFilter, setPaymentFilter] =
		useState<ReimbursementReviewPaymentFilter>(ALL_REIMBURSEMENT_REVIEW_FILTER);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [rejectionReasons, setRejectionReasons] = useState<
		Record<string, string>
	>({});

	const departments = useMemo(() => getDepartments(requests), [requests]);
	const filteredRequests = useMemo(
		() =>
			sortRequestsByDateDesc(
				requests.filter((request) => {
					if (!matchesReimbursementReviewSearch(request, search)) return false;
					if (
						departmentFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER &&
						request.department !== departmentFilter
					) {
						return false;
					}
					if (
						approvalFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER &&
						request.approval_status !== approvalFilter
					) {
						return false;
					}
					if (
						paymentFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER &&
						request.payment_status !== paymentFilter
					) {
						return false;
					}
					return true;
				}),
			),
		[requests, search, departmentFilter, approvalFilter, paymentFilter],
	);
	const selectedDownloadableIds = useMemo(
		() =>
			Array.from(selectedIds).filter((requestId) =>
				requests.some(
					(request) =>
						request.id === requestId &&
						request.receipt_filename &&
						hasReceiptEndpoint(request),
				),
			),
		[selectedIds, requests],
	);
	const queueStats = useMemo(() => getQueueStats(requests), [requests]);
	const hasActiveFilters =
		search.trim() !== "" ||
		departmentFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER ||
		approvalFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER ||
		paymentFilter !== ALL_REIMBURSEMENT_REVIEW_FILTER;

	const handleReview = async (
		requestId: string,
		action: ReimbursementReviewAction,
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

	const handleDepartmentChange = async (
		requestId: string,
		department: string,
	): Promise<void> => {
		try {
			await updateDepartmentAsync({ requestId, department });
			showToast("Reimbursement department updated.", "success");
		} catch (updateError) {
			showToast(
				`Could not update reimbursement department: ${getErrorMessage(updateError)}`,
				"error",
			);
		}
	};

	const handleQuickFilter = (
		filter: "all" | "needs_approval" | "approved_not_paid" | "closed",
	): void => {
		if (filter === "all") {
			setApprovalFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
			setPaymentFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
			setDepartmentFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
		}
		if (filter === "needs_approval") {
			setApprovalFilter("pending");
			setPaymentFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
		}
		if (filter === "approved_not_paid") {
			setApprovalFilter("approved");
			setPaymentFilter("to_be_paid");
		}
		if (filter === "closed") {
			setApprovalFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
			setPaymentFilter("paid");
		}
	};

	const clearFilters = (): void => {
		setSearch("");
		setDepartmentFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
		setApprovalFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
		setPaymentFilter(ALL_REIMBURSEMENT_REVIEW_FILTER);
	};

	const handleBulkDownload = async (): Promise<void> => {
		try {
			await bulkDownloadReceiptsAsync(selectedDownloadableIds);
			setSelectedIds(new Set());
			showToast("Selected receipts downloaded.", "success");
		} catch (downloadError) {
			showToast(
				`Could not download receipts: ${getErrorMessage(downloadError)}`,
				"error",
			);
		}
	};

	const handleReceiptOpen = async (
		request: ReimbursementRequest,
		mode: "view" | "download",
	): Promise<void> => {
		try {
			if (mode === "view") {
				await openReceiptAsync(request);
			} else {
				await downloadReceiptAsync(request);
			}
		} catch (receiptError) {
			showToast(
				`Could not open receipt: ${getErrorMessage(receiptError)}`,
				"error",
			);
		}
	};

	return (
		<ToolPageShell
			title="Finance Review"
			description="Review reimbursement and invoice requests, then mark approved requests as paid."
			maxWidth={1440}
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
				<Box sx={{ display: "grid", gap: 2.5 }}>
					<ReimbursementReviewControls
						search={search}
						onSearchChange={setSearch}
						departments={departments}
						departmentFilter={departmentFilter}
						onDepartmentFilterChange={setDepartmentFilter}
						approvalFilter={approvalFilter}
						onApprovalFilterChange={setApprovalFilter}
						paymentFilter={paymentFilter}
						onPaymentFilterChange={setPaymentFilter}
						hasActiveFilters={hasActiveFilters}
						onClearFilters={clearFilters}
						onQuickFilter={handleQuickFilter}
						queueStats={queueStats}
						filteredCount={filteredRequests.length}
						totalCount={requests.length}
						selectedCount={selectedDownloadableIds.length}
						canBulkDownload={
							canBulkDownloadReceipts && selectedDownloadableIds.length > 0
						}
						isBulkDownloading={isBulkDownloadingReceipts}
						onBulkDownload={handleBulkDownload}
					/>

					<ReimbursementReviewQueue
						requests={filteredRequests}
						selectedIds={selectedIds}
						onSelectionChange={(requestId, checked) =>
							setSelectedIds((current) => {
								const next = new Set(current);
								if (checked) {
									next.add(requestId);
								} else {
									next.delete(requestId);
								}
								return next;
							})
						}
						isReviewing={isReviewing}
						rejectionReasons={rejectionReasons}
						onReasonChange={(requestId, reason) =>
							setRejectionReasons((current) => ({
								...current,
								[requestId]: reason,
							}))
						}
						onReview={handleReview}
						onDepartmentChange={handleDepartmentChange}
						hasBulkDownload={canBulkDownloadReceipts}
						isUpdatingDepartment={isUpdatingDepartment}
						onReceiptOpen={handleReceiptOpen}
					/>
				</Box>
			)}
		</ToolPageShell>
	);
}
