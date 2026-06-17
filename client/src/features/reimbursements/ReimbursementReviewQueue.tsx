import { ExternalLink, FileText, RefreshCw } from "lucide-react";
import type React from "react";
import { useId } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DEPARTMENTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ReimbursementReviewActions } from "./ReimbursementReviewActions";
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
import type {
	BuchhaltungsButlerSyncStatus,
	ReimbursementRequest,
	ReimbursementReviewAction,
} from "./reimbursementTypes";

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
	onDepartmentChange: (requestId: string, department: string) => Promise<void>;
	hasBulkDownload: boolean;
	isUpdatingDepartment: boolean;
	onReceiptOpen: (
		request: ReimbursementRequest,
		mode: "view" | "download",
	) => Promise<void>;
	buchhaltungsButlerSyncStatus: BuchhaltungsButlerSyncStatus | null;
	isLoadingBuchhaltungsButlerSyncStatus: boolean;
	hasBuchhaltungsButlerSyncStatusError: boolean;
	onBuchhaltungsButlerSync: (requestId: string) => Promise<void>;
	isSyncingBuchhaltungsButler: boolean;
}

export function ReimbursementReviewQueue({
	requests,
	selectedIds,
	onSelectionChange,
	isReviewing,
	rejectionReasons,
	onReasonChange,
	onReview,
	onDepartmentChange,
	hasBulkDownload,
	isUpdatingDepartment,
	onReceiptOpen,
	buchhaltungsButlerSyncStatus,
	isLoadingBuchhaltungsButlerSyncStatus,
	hasBuchhaltungsButlerSyncStatusError,
	onBuchhaltungsButlerSync,
	isSyncingBuchhaltungsButler,
}: ReimbursementReviewQueueProps): React.ReactElement {
	if (requests.length === 0) {
		return (
			<Alert>
				<AlertDescription>
					No reimbursement requests match the current filters.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="grid gap-3">
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
					onDepartmentChange={(department) =>
						onDepartmentChange(request.id, department)
					}
					onReceiptOpen={(mode) => onReceiptOpen(request, mode)}
					isUpdatingDepartment={isUpdatingDepartment}
					buchhaltungsButlerSyncStatus={buchhaltungsButlerSyncStatus}
					isLoadingBuchhaltungsButlerSyncStatus={
						isLoadingBuchhaltungsButlerSyncStatus
					}
					hasBuchhaltungsButlerSyncStatusError={
						hasBuchhaltungsButlerSyncStatusError
					}
					onBuchhaltungsButlerSync={() => onBuchhaltungsButlerSync(request.id)}
					isSyncingBuchhaltungsButler={isSyncingBuchhaltungsButler}
				/>
			))}
		</div>
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
	onDepartmentChange: (department: string) => Promise<void>;
	onReceiptOpen: (mode: "view" | "download") => Promise<void>;
	isUpdatingDepartment: boolean;
	buchhaltungsButlerSyncStatus: BuchhaltungsButlerSyncStatus | null;
	isLoadingBuchhaltungsButlerSyncStatus: boolean;
	hasBuchhaltungsButlerSyncStatusError: boolean;
	onBuchhaltungsButlerSync: () => Promise<void>;
	isSyncingBuchhaltungsButler: boolean;
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
	onDepartmentChange,
	onReceiptOpen,
	isUpdatingDepartment,
	buchhaltungsButlerSyncStatus,
	isLoadingBuchhaltungsButlerSyncStatus,
	hasBuchhaltungsButlerSyncStatusError,
	onBuchhaltungsButlerSync,
	isSyncingBuchhaltungsButler,
}: ReviewItemProps): React.ReactElement {
	const requesterName = getRequesterName(request);
	const selectable =
		hasBulkDownload &&
		Boolean(request.receipt_filename) &&
		hasReceiptEndpoint(request);
	const typeLabel =
		request.submission_type === "invoice" ? "Invoice" : "Reimbursement";
	const bbSyncStatus = request.bb_sync_status ?? "not_synced";

	return (
		<GlassCard className="overflow-hidden">
			<Accordion type="single" collapsible>
				<AccordionItem value={request.id} className="border-b-0">
					<div className="flex items-center gap-3 px-3 py-1 md:px-4">
						{hasBulkDownload && (
							<Checkbox
								checked={selected}
								disabled={!selectable}
								onClick={(event) => event.stopPropagation()}
								onCheckedChange={(checked) =>
									onSelectionChange(request.id, checked === true)
								}
								aria-label={`Select receipt from ${requesterName}`}
							/>
						)}
						<div className="min-w-0 flex-1">
							<AccordionTrigger className="w-full items-center py-3 hover:no-underline">
								<div className="flex w-full min-w-0 flex-col items-stretch gap-2 pr-1 lg:flex-row lg:items-center lg:gap-4">
									<div className="min-w-0 flex-[1_1_auto]">
										<div className="mb-1.5 flex flex-wrap items-center gap-1.5">
											<Badge
												variant={getReviewStageTone(getReviewStage(request))}
												className="font-semibold"
											>
												{getReviewStage(request)}
											</Badge>
											<Badge variant="outline">{typeLabel}</Badge>
											<Badge variant="outline">{request.department}</Badge>
											<Badge
												variant={getBuchhaltungsButlerSyncTone(bbSyncStatus)}
											>
												{`BB: ${formatBuchhaltungsButlerSyncStatus(bbSyncStatus)}`}
											</Badge>
										</div>
										<p className="font-bold break-words">
											{request.description}
										</p>
										<p className="text-sm font-normal text-muted-foreground">
											{requesterName} · {formatReviewDate(request.date)}
										</p>
									</div>

									<div className="flex items-center justify-end lg:min-w-[120px] lg:flex-[0_0_auto]">
										<p className="text-lg font-extrabold whitespace-nowrap tabular-nums">
											{formatReviewAmount(request.amount)}
										</p>
									</div>
								</div>
							</AccordionTrigger>
						</div>
					</div>

					<AccordionContent className="px-4 pt-0 pb-6 md:px-6">
						<Separator className="mb-4" />
						<div className="flex flex-col gap-5">
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_1.4fr_1fr]">
								<DetailGroup title="Requester">
									<Detail label="Name" value={requesterName} strong />
									<Detail label="Email" value={getRequesterEmail(request)} />
									<DepartmentEditor
										department={request.department}
										disabled={isUpdatingDepartment}
										onDepartmentChange={onDepartmentChange}
									/>
								</DetailGroup>

								<DetailGroup title="Payment">
									<Detail label="Bank" value={getBankName(request)} />
									<Detail
										label="IBAN"
										value={getPaymentIban(request)}
										monospace
									/>
									<Detail
										label="BIC"
										value={getPaymentBic(request)}
										monospace
									/>
								</DetailGroup>

								<DetailGroup title="Receipt">
									<Detail
										label="File"
										value={request.receipt_filename ?? "No file"}
									/>
									<ReceiptLinks
										request={request}
										onReceiptOpen={onReceiptOpen}
									/>
								</DetailGroup>
							</div>

							<Separator />

							<DetailGroup title="BuchhaltungsButler">
								<Detail
									label="Sync status"
									value={formatBuchhaltungsButlerSyncStatus(bbSyncStatus)}
									strong
								/>
								{request.bb_receipt_id_by_customer && (
									<Detail
										label="Receipt ID"
										value={request.bb_receipt_id_by_customer}
										monospace
									/>
								)}
								{request.bb_sync_error && (
									<Detail label="Last error" value={request.bb_sync_error} />
								)}
								<BuchhaltungsButlerSyncButton
									request={request}
									syncStatus={buchhaltungsButlerSyncStatus}
									isLoadingSyncStatus={isLoadingBuchhaltungsButlerSyncStatus}
									hasSyncStatusError={hasBuchhaltungsButlerSyncStatusError}
									onSync={onBuchhaltungsButlerSync}
									isSyncing={isSyncingBuchhaltungsButler}
								/>
							</DetailGroup>

							<div>
								<span className="mb-1 block text-xs text-muted-foreground">
									Description
								</span>
								<p className="break-words">{request.description}</p>
							</div>

							<ReimbursementReviewActions
								request={request}
								isReviewing={isReviewing}
								rejectionReason={rejectionReason}
								onReasonChange={onReasonChange}
								onReview={onReview}
							/>
						</div>
					</AccordionContent>
				</AccordionItem>
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
		<div className="grid min-w-0 content-start gap-2">
			<p className="text-sm font-extrabold">{title}</p>
			{children}
		</div>
	);
}

function DepartmentEditor({
	department,
	disabled,
	onDepartmentChange,
}: {
	department: string;
	disabled: boolean;
	onDepartmentChange: (department: string) => Promise<void>;
}): React.ReactElement {
	const labelId = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={labelId}>Request department</Label>
			<Select
				value={department || undefined}
				onValueChange={(value) => {
					void onDepartmentChange(value);
				}}
				disabled={disabled}
			>
				<SelectTrigger
					id={labelId}
					size="sm"
					className="w-full"
					aria-label="Request department"
				>
					<SelectValue placeholder="Request department" />
				</SelectTrigger>
				<SelectContent>
					{DEPARTMENTS.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
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
		<div>
			<span className="text-xs text-muted-foreground">{label}</span>
			<p
				className={cn(
					"text-sm break-words",
					strong ? "font-bold" : "font-medium",
					monospace && "font-mono",
				)}
			>
				{value}
			</p>
		</div>
	);
}

function formatBuchhaltungsButlerSyncStatus(status: string): string {
	if (status === "pending") return "Syncing";
	if (status === "synced") return "Synced";
	if (status === "failed") return "Failed";
	return "Not synced";
}

function getBuchhaltungsButlerSyncTone(status: string): BadgeVariant {
	if (status === "failed") return "danger";
	if (status === "synced") return "accent";
	if (status === "pending") return "accent";
	return "neutral";
}

function getReviewStageTone(stage: string): BadgeVariant {
	if (stage === "Paid") return "success";
	if (stage === "Ready for payment") return "accent";
	if (stage === "Rejected") return "danger";
	// Needs approval
	return "warning";
}

function BuchhaltungsButlerSyncButton({
	request,
	syncStatus,
	isLoadingSyncStatus,
	hasSyncStatusError,
	onSync,
	isSyncing,
}: {
	request: ReimbursementRequest;
	syncStatus: BuchhaltungsButlerSyncStatus | null;
	isLoadingSyncStatus: boolean;
	hasSyncStatusError: boolean;
	onSync: () => Promise<void>;
	isSyncing: boolean;
}): React.ReactElement | null {
	const isApproved = request.approval_status === "approved";
	const isSynced = request.bb_sync_status === "synced";
	if (!isApproved || isSynced) {
		return null;
	}

	const unavailableMessage =
		getBuchhaltungsButlerUnavailableMessage(syncStatus);
	const isUnavailable =
		isLoadingSyncStatus ||
		hasSyncStatusError ||
		!syncStatus ||
		Boolean(unavailableMessage);
	const isPending = request.bb_sync_status === "pending";

	return (
		<div className="flex flex-col items-start gap-1">
			<Button
				variant="outline"
				size="sm"
				disabled={isUnavailable || isSyncing || isPending}
				onClick={() => {
					void onSync();
				}}
			>
				<RefreshCw className="size-4" />
				{isLoadingSyncStatus
					? "Checking sync..."
					: isUnavailable
						? "Sync unavailable"
						: isSyncing || isPending
							? "Syncing..."
							: "Sync to BuchhaltungsButler"}
			</Button>
			{(isLoadingSyncStatus ||
				hasSyncStatusError ||
				!syncStatus ||
				unavailableMessage) && (
				<p className="text-xs text-muted-foreground">
					{getBuchhaltungsButlerAvailabilityMessage({
						isLoading: isLoadingSyncStatus,
						hasError: hasSyncStatusError,
						status: syncStatus,
						unavailableMessage,
					})}
				</p>
			)}
		</div>
	);
}

function getBuchhaltungsButlerUnavailableMessage(
	status: BuchhaltungsButlerSyncStatus | null,
): string | null {
	if (!status || status.available) {
		return null;
	}
	if (status.unavailable_reason === "disabled") {
		return "BuchhaltungsButler sync is disabled.";
	}
	if (status.unavailable_reason === "missing_credentials") {
		return "BuchhaltungsButler credentials are missing.";
	}
	return "BuchhaltungsButler sync is unavailable.";
}

function getBuchhaltungsButlerAvailabilityMessage({
	isLoading,
	hasError,
	status,
	unavailableMessage,
}: {
	isLoading: boolean;
	hasError: boolean;
	status: BuchhaltungsButlerSyncStatus | null;
	unavailableMessage: string | null;
}): string {
	if (isLoading) {
		return "Checking BuchhaltungsButler availability.";
	}
	if (hasError || !status) {
		return "BuchhaltungsButler availability could not be checked.";
	}
	return unavailableMessage ?? "BuchhaltungsButler sync is unavailable.";
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
		return <p className="text-sm text-muted-foreground">No receipt</p>;
	}

	return (
		<div className="flex flex-row flex-wrap gap-3">
			{viewUrl && (
				<LinkButton
					asChild
					className="inline-flex items-center gap-1.5 text-sm"
				>
					<a
						href={viewUrl}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`View receipt for ${getRequesterName(request)}`}
						onClick={(event) => {
							if (!onReceiptOpen) return;
							event.preventDefault();
							void onReceiptOpen("view");
						}}
					>
						<ExternalLink className="size-4" />
						View receipt
					</a>
				</LinkButton>
			)}
			{downloadUrl && (
				<LinkButton
					asChild
					className="inline-flex items-center gap-1.5 text-sm"
				>
					<a
						href={downloadUrl}
						download
						aria-label={`Download receipt for ${getRequesterName(request)}`}
						onClick={(event) => {
							if (!onReceiptOpen) return;
							event.preventDefault();
							void onReceiptOpen("download");
						}}
					>
						<FileText className="size-4" />
						Download receipt
					</a>
				</LinkButton>
			)}
			{!viewUrl && !downloadUrl && (
				<p className="text-sm text-muted-foreground">
					{request.receipt_filename}
				</p>
			)}
		</div>
	);
}
