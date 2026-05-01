import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import {
	Alert,
	alpha,
	Box,
	CardContent,
	Checkbox,
	Chip,
	Link,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
	useTheme,
} from "@mui/material";
import type React from "react";
import GlassCard from "../../components/ui/GlassCard";
import type {
	ReimbursementRequest,
	ReimbursementReviewAction,
} from "../../hooks/useReimbursementRequests";
import ReimbursementReviewActions from "./ReimbursementReviewActions";
import {
	formatReviewAmount,
	formatReviewDate,
	formatReviewStatus,
	getBankName,
	getPaymentBic,
	getPaymentIban,
	getReceiptLinks,
	getRequesterEmail,
	getRequesterName,
	getReviewStage,
	hasReceiptEndpoint,
} from "./reimbursementReviewUtils";

interface ReimbursementReviewQueueProps {
	requests: ReimbursementRequest[];
	selectedIds: Set<string>;
	onSelectionChange: (requestId: string, checked: boolean) => void;
	isReviewing: boolean;
	rejectionReasons: Record<string, string>;
	onReasonChange: (requestId: string, reason: string) => void;
	onReview: (
		requestId: string,
		action: ReimbursementReviewAction,
	) => Promise<void>;
	hasBulkDownload: boolean;
	onReceiptOpen: (
		request: ReimbursementRequest,
		mode: "view" | "download",
	) => Promise<void>;
}

export default function ReimbursementReviewQueue({
	requests,
	selectedIds,
	onSelectionChange,
	isReviewing,
	rejectionReasons,
	onReasonChange,
	onReview,
	hasBulkDownload,
	onReceiptOpen,
}: ReimbursementReviewQueueProps): React.ReactElement {
	if (requests.length === 0) {
		return (
			<Alert severity="info">
				No reimbursement requests match the current filters.
			</Alert>
		);
	}

	return (
		<Stack spacing={2}>
			<ReviewTable
				requests={requests}
				selectedIds={selectedIds}
				onSelectionChange={onSelectionChange}
				isReviewing={isReviewing}
				rejectionReasons={rejectionReasons}
				onReasonChange={onReasonChange}
				onReview={onReview}
				hasBulkDownload={hasBulkDownload}
				onReceiptOpen={onReceiptOpen}
			/>
			<Box sx={{ display: { xs: "grid", lg: "none" }, gap: 1.5 }}>
				{requests.map((request) => (
					<ReviewCard
						key={request.id}
						request={request}
						isReviewing={isReviewing}
						rejectionReason={rejectionReasons[request.id] ?? ""}
						onReasonChange={(reason) => onReasonChange(request.id, reason)}
						onReview={(action) => onReview(request.id, action)}
						onReceiptOpen={(mode) => onReceiptOpen(request, mode)}
					/>
				))}
			</Box>
		</Stack>
	);
}

function ReviewTable({
	requests,
	selectedIds,
	onSelectionChange,
	isReviewing,
	rejectionReasons,
	onReasonChange,
	onReview,
	hasBulkDownload,
	onReceiptOpen,
}: ReimbursementReviewQueueProps): React.ReactElement {
	const theme = useTheme();

	return (
		<GlassCard variant="elevated" sx={{ display: { xs: "none", lg: "block" } }}>
			<TableContainer>
				<Table size="small" sx={{ minWidth: 1420 }}>
					<TableHead>
						<TableRow>
							<TableCell padding="checkbox">Select</TableCell>
							<TableCell>Type</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Department</TableCell>
							<TableCell>Requester</TableCell>
							<TableCell>Email</TableCell>
							<TableCell>Bank</TableCell>
							<TableCell>IBAN</TableCell>
							<TableCell>BIC</TableCell>
							<TableCell>Date</TableCell>
							<TableCell>Description</TableCell>
							<TableCell align="right">Amount</TableCell>
							<TableCell>Receipt</TableCell>
							<TableCell>Action</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{requests.map((request) => (
							<ReviewTableRow
								key={request.id}
								request={request}
								selected={selectedIds.has(request.id)}
								hasBulkDownload={hasBulkDownload}
								isReviewing={isReviewing}
								rejectionReason={rejectionReasons[request.id] ?? ""}
								onSelectionChange={onSelectionChange}
								onReasonChange={(reason) => onReasonChange(request.id, reason)}
								onReview={(action) => onReview(request.id, action)}
								onReceiptOpen={(mode) => onReceiptOpen(request, mode)}
								rowBorder={alpha(theme.palette.divider, 0.86)}
							/>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</GlassCard>
	);
}

interface ReviewTableRowProps {
	request: ReimbursementRequest;
	selected: boolean;
	hasBulkDownload: boolean;
	isReviewing: boolean;
	rejectionReason: string;
	onSelectionChange: (requestId: string, checked: boolean) => void;
	onReasonChange: (reason: string) => void;
	onReview: (action: ReimbursementReviewAction) => Promise<void>;
	onReceiptOpen: (mode: "view" | "download") => Promise<void>;
	rowBorder: string;
}

function ReviewTableRow({
	request,
	selected,
	hasBulkDownload,
	isReviewing,
	rejectionReason,
	onSelectionChange,
	onReasonChange,
	onReview,
	onReceiptOpen,
	rowBorder,
}: ReviewTableRowProps): React.ReactElement {
	const requesterName = getRequesterName(request);
	const selectable =
		hasBulkDownload &&
		Boolean(request.receipt_filename) &&
		hasReceiptEndpoint(request);

	return (
		<TableRow
			hover
			sx={{
				"& td": {
					borderBottom: `1px solid ${rowBorder}`,
				},
			}}
		>
			<TableCell padding="checkbox">
				<Checkbox
					checked={selected}
					disabled={!selectable}
					onChange={(event) =>
						onSelectionChange(request.id, event.target.checked)
					}
					inputProps={{
						"aria-label": `Select request from ${requesterName}`,
					}}
				/>
			</TableCell>
			<TableCell>
				<Chip
					size="small"
					label={
						request.submission_type === "invoice" ? "Invoice" : "Reimbursement"
					}
					variant="outlined"
				/>
			</TableCell>
			<TableCell>
				<StatusStack request={request} />
			</TableCell>
			<TableCell>{request.department}</TableCell>
			<TableCell sx={{ fontWeight: 700 }}>{requesterName}</TableCell>
			<TableCell>{getRequesterEmail(request)}</TableCell>
			<TableCell>{getBankName(request)}</TableCell>
			<TableCell sx={{ fontFamily: "monospace" }}>
				{getPaymentIban(request)}
			</TableCell>
			<TableCell sx={{ fontFamily: "monospace" }}>
				{getPaymentBic(request)}
			</TableCell>
			<TableCell>{formatReviewDate(request.date)}</TableCell>
			<TableCell sx={{ maxWidth: 260 }}>
				<Typography
					variant="body2"
					title={request.description}
					sx={{
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{request.description}
				</Typography>
			</TableCell>
			<TableCell align="right" sx={{ fontWeight: 700 }}>
				{formatReviewAmount(request.amount)}
			</TableCell>
			<TableCell>
				<ReceiptLinks request={request} onReceiptOpen={onReceiptOpen} />
			</TableCell>
			<TableCell sx={{ minWidth: 220 }}>
				<ReimbursementReviewActions
					request={request}
					isReviewing={isReviewing}
					rejectionReason={rejectionReason}
					onReasonChange={onReasonChange}
					onReview={onReview}
					compact
				/>
			</TableCell>
		</TableRow>
	);
}

interface ReviewCardProps {
	request: ReimbursementRequest;
	isReviewing: boolean;
	rejectionReason: string;
	onReasonChange: (reason: string) => void;
	onReview: (action: ReimbursementReviewAction) => Promise<void>;
	onReceiptOpen: (mode: "view" | "download") => Promise<void>;
}

function ReviewCard({
	request,
	isReviewing,
	rejectionReason,
	onReasonChange,
	onReview,
	onReceiptOpen,
}: ReviewCardProps): React.ReactElement {
	const requesterName = getRequesterName(request);

	return (
		<GlassCard>
			<CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
				<Stack spacing={2}>
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
								flexWrap="wrap"
								useFlexGap
								sx={{ mb: 1 }}
							>
								<StatusStack request={request} />
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
								· {formatReviewDate(request.date)}
							</Typography>
						</Box>
						<Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
							{formatReviewAmount(request.amount)}
						</Typography>
					</Stack>

					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
							gap: 1.25,
						}}
					>
						<Detail label="Requester" value={requesterName} strong />
						<Detail label="Email" value={getRequesterEmail(request)} />
						<Detail label="Bank" value={getBankName(request)} />
						<Detail label="IBAN" value={getPaymentIban(request)} monospace />
						<Detail label="BIC" value={getPaymentBic(request)} monospace />
						<Detail
							label="Receipt"
							value={request.receipt_filename ?? "No file"}
						/>
					</Box>

					<ReceiptLinks request={request} onReceiptOpen={onReceiptOpen} />
					<ReimbursementReviewActions
						request={request}
						isReviewing={isReviewing}
						rejectionReason={rejectionReason}
						onReasonChange={onReasonChange}
						onReview={onReview}
					/>
				</Stack>
			</CardContent>
		</GlassCard>
	);
}

function StatusStack({
	request,
}: {
	request: ReimbursementRequest;
}): React.ReactElement {
	return (
		<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
			<Chip label={getReviewStage(request)} size="small" />
			<Chip
				label={formatReviewStatus(request.approval_status)}
				size="small"
				variant="outlined"
			/>
			<Chip
				label={formatReviewStatus(request.payment_status)}
				size="small"
				variant="outlined"
			/>
		</Stack>
	);
}

function Detail({
	label,
	value,
	strong = false,
	monospace = false,
}: {
	label: string;
	value: string;
	strong?: boolean;
	monospace?: boolean;
}): React.ReactElement {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary">
				{label}
			</Typography>
			<Typography
				variant="body2"
				sx={{
					fontWeight: strong ? 700 : 500,
					fontFamily: monospace ? "monospace" : undefined,
					overflowWrap: "anywhere",
				}}
			>
				{value}
			</Typography>
		</Box>
	);
}

function ReceiptLinks({
	request,
	onReceiptOpen,
}: {
	request: ReimbursementRequest;
	onReceiptOpen?: (mode: "view" | "download") => Promise<void>;
}): React.ReactElement {
	const { viewUrl, downloadUrl } = getReceiptLinks(request);

	if (!request.receipt_filename && !viewUrl && !downloadUrl) {
		return (
			<Typography variant="body2" color="text.secondary">
				No receipt
			</Typography>
		);
	}

	return (
		<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
			{viewUrl && (
				<Link
					href={viewUrl}
					target="_blank"
					rel="noopener noreferrer"
					underline="none"
					aria-label={`View receipt for ${getRequesterName(request)}`}
					onClick={(event) => {
						if (!onReceiptOpen) return;
						event.preventDefault();
						void onReceiptOpen("view");
					}}
					sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
				>
					<OpenInNewIcon fontSize="small" />
					View receipt
				</Link>
			)}
			{downloadUrl && (
				<Link
					href={downloadUrl}
					download
					underline="none"
					aria-label={`Download receipt for ${getRequesterName(request)}`}
					onClick={(event) => {
						if (!onReceiptOpen) return;
						event.preventDefault();
						void onReceiptOpen("download");
					}}
					sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
				>
					<ReceiptLongIcon fontSize="small" />
					Download receipt
				</Link>
			)}
			{!viewUrl && !downloadUrl && (
				<Typography variant="body2" color="text.secondary">
					{request.receipt_filename}
				</Typography>
			)}
		</Stack>
	);
}
