import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Alert,
	Box,
	Checkbox,
	Chip,
	Divider,
	Link,
	Stack,
	Typography,
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
			<Box
				sx={{
					display: "grid",
					gap: 1.25,
				}}
			>
				{requests.map((request) => (
					<ReviewItem
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
					/>
				))}
			</Box>
		</Stack>
	);
}

interface ReviewItemProps {
	request: ReimbursementRequest;
	selected: boolean;
	hasBulkDownload: boolean;
	isReviewing: boolean;
	rejectionReason: string;
	onSelectionChange: (requestId: string, checked: boolean) => void;
	onReasonChange: (reason: string) => void;
	onReview: (action: ReimbursementReviewAction) => Promise<void>;
	onReceiptOpen: (mode: "view" | "download") => Promise<void>;
}

function ReviewItem({
	request,
	selected,
	hasBulkDownload,
	isReviewing,
	rejectionReason,
	onSelectionChange,
	onReasonChange,
	onReview,
	onReceiptOpen,
}: ReviewItemProps): React.ReactElement {
	const requesterName = getRequesterName(request);
	const selectable =
		hasBulkDownload &&
		Boolean(request.receipt_filename) &&
		hasReceiptEndpoint(request);
	const typeLabel =
		request.submission_type === "invoice" ? "Invoice" : "Reimbursement";

	return (
		<GlassCard sx={{ overflow: "hidden" }}>
			<Accordion
				disableGutters
				elevation={0}
				sx={{
					bgcolor: "transparent",
					"&:before": { display: "none" },
				}}
			>
				<AccordionSummary
					expandIcon={<ExpandMoreIcon />}
					sx={{
						alignItems: "flex-start",
						px: { xs: 1.5, md: 2.25 },
						py: 1,
						"& .MuiAccordionSummary-content": {
							my: 0,
							minWidth: 0,
						},
					}}
				>
					<Stack
						direction={{ xs: "column", lg: "row" }}
						spacing={{ xs: 1.25, lg: 2 }}
						alignItems={{ xs: "stretch", lg: "center" }}
						sx={{ width: "100%", minWidth: 0, pr: 1 }}
					>
						<Stack
							direction="row"
							spacing={1}
							alignItems="flex-start"
							sx={{ minWidth: 0, flex: "1 1 auto" }}
						>
							{hasBulkDownload && (
								<Checkbox
									checked={selected}
									disabled={!selectable}
									onClick={(event) => event.stopPropagation()}
									onFocus={(event) => event.stopPropagation()}
									onChange={(event) =>
										onSelectionChange(request.id, event.target.checked)
									}
									inputProps={{
										"aria-label": `Select receipt from ${requesterName}`,
									}}
									sx={{ mt: -0.75, ml: -1 }}
								/>
							)}
							<Box sx={{ minWidth: 0 }}>
								<Stack
									direction="row"
									spacing={0.75}
									alignItems="center"
									flexWrap="wrap"
									useFlexGap
									sx={{ mb: 0.75 }}
								>
									<Chip label={getReviewStage(request)} size="small" />
									<Chip label={typeLabel} size="small" variant="outlined" />
									<Chip
										label={request.department}
										size="small"
										variant="outlined"
									/>
								</Stack>
								<Typography
									variant="subtitle1"
									fontWeight={700}
									sx={{ overflowWrap: "anywhere" }}
								>
									{request.description}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									{requesterName} · {formatReviewDate(request.date)}
								</Typography>
							</Box>
						</Stack>

						<Stack
							direction="row"
							spacing={2}
							alignItems="center"
							justifyContent="flex-end"
							sx={{
								flex: { xs: "1 1 auto", lg: "0 0 auto" },
								minWidth: { lg: 120 },
							}}
						>
							<Typography
								variant="h6"
								fontWeight={800}
								sx={{ whiteSpace: "nowrap" }}
							>
								{formatReviewAmount(request.amount)}
							</Typography>
						</Stack>
					</Stack>
				</AccordionSummary>

				<AccordionDetails sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: 3 }}>
					<Divider sx={{ mb: 2 }} />
					<Stack spacing={2.25}>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: {
									xs: "1fr",
									md: "1fr 1fr",
									xl: "1.1fr 1.4fr 1fr",
								},
								gap: 2,
							}}
						>
							<DetailGroup title="Requester">
								<Detail label="Name" value={requesterName} strong />
								<Detail label="Email" value={getRequesterEmail(request)} />
								<Detail label="Department" value={request.department} />
							</DetailGroup>

							<DetailGroup title="Payment">
								<Detail label="Bank" value={getBankName(request)} />
								<Detail
									label="IBAN"
									value={getPaymentIban(request)}
									monospace
								/>
								<Detail label="BIC" value={getPaymentBic(request)} monospace />
							</DetailGroup>

							<DetailGroup title="Receipt">
								<Detail
									label="File"
									value={request.receipt_filename ?? "No file"}
								/>
								<ReceiptLinks request={request} onReceiptOpen={onReceiptOpen} />
							</DetailGroup>
						</Box>

						<Box>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ display: "block", mb: 0.5 }}
							>
								Description
							</Typography>
							<Typography sx={{ overflowWrap: "anywhere" }}>
								{request.description}
							</Typography>
						</Box>

						<ReimbursementReviewActions
							request={request}
							isReviewing={isReviewing}
							rejectionReason={rejectionReason}
							onReasonChange={onReasonChange}
							onReview={onReview}
						/>
					</Stack>
				</AccordionDetails>
			</Accordion>
		</GlassCard>
	);
}

function DetailGroup({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<Box
			sx={{
				display: "grid",
				alignContent: "start",
				gap: 1,
				minWidth: 0,
			}}
		>
			<Typography variant="subtitle2" fontWeight={800}>
				{title}
			</Typography>
			{children}
		</Box>
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
