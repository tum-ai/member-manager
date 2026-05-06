import ClearIcon from "@mui/icons-material/Clear";
import DownloadIcon from "@mui/icons-material/Download";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
	Button,
	CardContent,
	FormControl,
	IconButton,
	InputAdornment,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import type React from "react";
import GlassCard from "../../components/ui/GlassCard";
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

export default function ReimbursementReviewControls({
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
			<CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
				<Stack spacing={2}>
					<Stack
						direction={{ xs: "column", md: "row" }}
						spacing={1.5}
						alignItems={{ xs: "stretch", md: "center" }}
					>
						<TextField
							label="Search reimbursement queue"
							value={search}
							onChange={(event) => onSearchChange(event.target.value)}
							size="small"
							placeholder="Name, email, description, IBAN..."
							InputProps={{
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon fontSize="small" />
									</InputAdornment>
								),
								endAdornment: search ? (
									<InputAdornment position="end">
										<IconButton
											aria-label="Clear search"
											size="small"
											onClick={() => onSearchChange("")}
										>
											<ClearIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								) : undefined,
							}}
						/>
						{canBulkDownload && (
							<Button
								variant="outlined"
								startIcon={<DownloadIcon />}
								disabled={isBulkDownloading}
								onClick={onBulkDownload}
								sx={{ whiteSpace: "nowrap" }}
							>
								Download selected receipts ({selectedCount})
							</Button>
						)}
					</Stack>

					<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
						<Button
							size="small"
							variant={isAllQuickFilter ? "contained" : "outlined"}
							onClick={() => onQuickFilter("all")}
						>
							All
						</Button>
						<Button
							size="small"
							variant={isNeedsApproval ? "contained" : "outlined"}
							onClick={() => onQuickFilter("needs_approval")}
						>
							Needs approval ({queueStats.needsApproval})
						</Button>
						<Button
							size="small"
							variant={isApprovedNotPaid ? "contained" : "outlined"}
							onClick={() => onQuickFilter("approved_not_paid")}
						>
							Approved, not paid ({queueStats.readyForPayment})
						</Button>
						<Button
							size="small"
							variant={isClosed ? "contained" : "outlined"}
							onClick={() => onQuickFilter("closed")}
						>
							Closed ({queueStats.closed})
						</Button>
					</Stack>

					<Stack
						direction={{ xs: "column", md: "row" }}
						spacing={1.5}
						alignItems={{ xs: "stretch", md: "center" }}
					>
						<FilterListIcon color="action" />
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
								variant="text"
								startIcon={<ClearIcon />}
								onClick={onClearFilters}
								sx={{ whiteSpace: "nowrap" }}
							>
								Clear filters
							</Button>
						)}
					</Stack>

					<Typography variant="body2" color="text.secondary">
						Showing {filteredCount} of {totalCount} reimbursement requests.
					</Typography>
				</Stack>
			</CardContent>
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
		<FormControl size="small" sx={{ minWidth: { xs: "100%", md: 180 } }}>
			<InputLabel id={labelId}>{label}</InputLabel>
			<Select
				labelId={labelId}
				label={label}
				value={value}
				onChange={(event: SelectChangeEvent<string>) =>
					onChange(event.target.value)
				}
			>
				{options.map((option) => (
					<MenuItem key={option.value} value={option.value}>
						{option.label}
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);
}
