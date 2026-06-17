import { Download, ListFilter, Search, X } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ALL_REIMBURSEMENT_REVIEW_FILTER,
	type ReimbursementReviewApprovalFilter,
	type ReimbursementReviewPaymentFilter,
} from "./reimbursementReviewUtils";

interface ReimbursementReviewControlsProps {
	search: string;
	onSearchChange: (value: string) => void;
	departments: string[];
	departmentFilter: string;
	onDepartmentFilterChange: (value: string) => void;
	approvalFilter: ReimbursementReviewApprovalFilter;
	onApprovalFilterChange: (value: ReimbursementReviewApprovalFilter) => void;
	paymentFilter: ReimbursementReviewPaymentFilter;
	onPaymentFilterChange: (value: ReimbursementReviewPaymentFilter) => void;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
	onQuickFilter: (
		filter: "all" | "needs_approval" | "approved_not_paid" | "closed",
	) => void;
	queueStats: {
		needsApproval: number;
		readyForPayment: number;
		closed: number;
	};
	filteredCount: number;
	totalCount: number;
	selectedCount: number;
	canBulkDownload: boolean;
	isBulkDownloading: boolean;
	onBulkDownload: () => Promise<void>;
}

export function ReimbursementReviewControls({
	search,
	onSearchChange,
	departments,
	departmentFilter,
	onDepartmentFilterChange,
	approvalFilter,
	onApprovalFilterChange,
	paymentFilter,
	onPaymentFilterChange,
	hasActiveFilters,
	onClearFilters,
	onQuickFilter,
	queueStats,
	filteredCount,
	totalCount,
	selectedCount,
	canBulkDownload,
	isBulkDownloading,
	onBulkDownload,
}: ReimbursementReviewControlsProps): React.ReactElement {
	const isAllQuickFilter =
		departmentFilter === ALL_REIMBURSEMENT_REVIEW_FILTER &&
		approvalFilter === ALL_REIMBURSEMENT_REVIEW_FILTER &&
		paymentFilter === ALL_REIMBURSEMENT_REVIEW_FILTER;
	const isNeedsApproval = approvalFilter === "pending";
	const isApprovedNotPaid =
		approvalFilter === "approved" && paymentFilter === "to_be_paid";
	const isClosed = paymentFilter === "paid";

	return (
		<GlassCard variant="elevated">
			<div className="p-4 md:p-5">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								aria-label="Search reimbursement queue"
								value={search}
								onChange={(event) => onSearchChange(event.target.value)}
								placeholder="Name, email, description, IBAN..."
								className="px-9"
							/>
							{search && (
								<Button
									type="button"
									aria-label="Clear search"
									variant="ghost"
									size="icon-sm"
									onClick={() => onSearchChange("")}
									className="absolute top-1/2 right-1 -translate-y-1/2"
								>
									<X className="size-4" />
								</Button>
							)}
						</div>
						{canBulkDownload && (
							<Button
								variant="outline"
								disabled={isBulkDownloading}
								onClick={onBulkDownload}
								className="whitespace-nowrap"
							>
								<Download className="size-4" />
								Download selected receipts ({selectedCount})
							</Button>
						)}
					</div>

					<div className="flex flex-row flex-wrap gap-2">
						<Button
							size="sm"
							variant={isAllQuickFilter ? "default" : "outline"}
							onClick={() => onQuickFilter("all")}
						>
							All
						</Button>
						<Button
							size="sm"
							variant={isNeedsApproval ? "default" : "outline"}
							onClick={() => onQuickFilter("needs_approval")}
						>
							Needs approval ({queueStats.needsApproval})
						</Button>
						<Button
							size="sm"
							variant={isApprovedNotPaid ? "default" : "outline"}
							onClick={() => onQuickFilter("approved_not_paid")}
						>
							Approved, not paid ({queueStats.readyForPayment})
						</Button>
						<Button
							size="sm"
							variant={isClosed ? "default" : "outline"}
							onClick={() => onQuickFilter("closed")}
						>
							Closed ({queueStats.closed})
						</Button>
					</div>

					<div className="flex flex-col gap-3 md:flex-row md:items-center">
						<ListFilter className="size-5 text-muted-foreground" />
						<ReviewSelect
							label="Department"
							value={departmentFilter}
							onChange={onDepartmentFilterChange}
							options={[
								{
									value: ALL_REIMBURSEMENT_REVIEW_FILTER,
									label: "All departments",
								},
								...departments.map((department) => ({
									value: department,
									label: department,
								})),
							]}
						/>
						<ReviewSelect
							label="Approval"
							value={approvalFilter}
							onChange={(value) =>
								onApprovalFilterChange(
									value as ReimbursementReviewApprovalFilter,
								)
							}
							options={[
								{
									value: ALL_REIMBURSEMENT_REVIEW_FILTER,
									label: "All approval statuses",
								},
								{ value: "pending", label: "Pending" },
								{ value: "approved", label: "Approved" },
								{ value: "not_approved", label: "Not approved" },
							]}
						/>
						<ReviewSelect
							label="Payment"
							value={paymentFilter}
							onChange={(value) =>
								onPaymentFilterChange(value as ReimbursementReviewPaymentFilter)
							}
							options={[
								{
									value: ALL_REIMBURSEMENT_REVIEW_FILTER,
									label: "All payment statuses",
								},
								{ value: "to_be_paid", label: "To be paid" },
								{ value: "paid", label: "Paid" },
							]}
						/>
						{hasActiveFilters && (
							<Button
								variant="ghost"
								onClick={onClearFilters}
								className="whitespace-nowrap"
							>
								<X className="size-4" />
								Clear filters
							</Button>
						)}
					</div>

					<p className="text-sm text-muted-foreground">
						Showing {filteredCount} of {totalCount} reimbursement requests.
					</p>
				</div>
			</div>
		</GlassCard>
	);
}

interface ReviewSelectProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: Array<{ value: string; label: string }>;
}

function ReviewSelect({
	label,
	value,
	onChange,
	options,
}: ReviewSelectProps): React.ReactElement {
	const labelId = `finance-review-${label.toLowerCase()}-label`;

	return (
		<div className="flex w-full flex-col gap-1.5 md:w-auto md:min-w-[180px]">
			<Label htmlFor={labelId}>{label}</Label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger
					id={labelId}
					size="sm"
					className="w-full"
					aria-label={label}
				>
					<SelectValue placeholder={label} />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
