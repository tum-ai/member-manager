import { reimbursementRequiresPayout } from "@member-manager/shared";
import { Download, ExternalLink } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
	formatReviewDate,
	formatReviewStatus,
	getMaskedPaymentIban,
	getPaymentBic,
	hasReceiptEndpoint,
} from "@/features/reimbursements/reimbursementReviewUtils";
import {
	formatAmount,
	formatDate,
	getRequestTypeLabel,
	getStatusLabel,
} from "@/features/reimbursements/reimbursementSubmitUtils";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { Detail, DetailGroup } from "./ReimbursementDetailFields";

interface ReimbursementRequestDetailDialogProps {
	/** Kept while closing so the content stays rendered during the exit animation. */
	request: ReimbursementRequest | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onViewReceipt: () => void;
	onDownloadReceipt: () => void;
	isOpeningReceipt: boolean;
	isDownloadingReceipt: boolean;
}

/**
 * Read-only view of what a member submitted for one of their own requests.
 * The IBAN is always masked here; only reviewers see the full value.
 */
export function ReimbursementRequestDetailDialog({
	request,
	open,
	onOpenChange,
	onViewReceipt,
	onDownloadReceipt,
	isOpeningReceipt,
	isDownloadingReceipt,
}: ReimbursementRequestDetailDialogProps): React.ReactElement {
	// The list buttons are not Radix `DialogTrigger`s, so Radix has no trigger
	// to refocus on close. Remember whichever element opened the dialog instead.
	const returnFocusRef = useRef<HTMLElement | null>(null);

	return (
		<Dialog open={open && request !== null} onOpenChange={onOpenChange}>
			{request && (
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-2xl"
					onOpenAutoFocus={() => {
						returnFocusRef.current =
							document.activeElement instanceof HTMLElement
								? document.activeElement
								: null;
					}}
					onCloseAutoFocus={(event) => {
						const opener = returnFocusRef.current;
						if (opener?.isConnected) {
							event.preventDefault();
							opener.focus();
						}
					}}
				>
					<DialogHeader className="pr-8 text-left">
						<DialogTitle>{getRequestTypeLabel(request)} request</DialogTitle>
						<DialogDescription>
							What you submitted for this request and where it stands.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap gap-1.5">
							<Badge variant="outline">{getRequestTypeLabel(request)}</Badge>
							<Badge variant={getStatusTone(request)}>
								{getStatusLabel(request)}
							</Badge>
						</div>
						<p className="text-2xl font-extrabold whitespace-nowrap tabular-nums">
							{formatAmount(request.amount)}
						</p>
					</div>

					{request.approval_status === "not_approved" &&
						request.rejection_reason && (
							<Alert variant="destructive">
								<AlertTitle>Rejection reason</AlertTitle>
								<AlertDescription className="break-words whitespace-pre-wrap">
									{request.rejection_reason}
								</AlertDescription>
							</Alert>
						)}

					<Separator />

					<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
						<DetailGroup title="Request">
							<Detail label="Expense date" value={formatDate(request.date)} />
							<Detail
								label="Department"
								value={request.department || "Not provided"}
							/>
							<Detail
								label="Submitted"
								value={formatReviewDate(request.created_at)}
							/>
							<Detail
								label="Last updated"
								value={formatReviewDate(request.updated_at)}
							/>
						</DetailGroup>

						<PaymentDetails request={request} />
					</div>

					<DetailGroup title="Description">
						<p className="text-sm break-words whitespace-pre-wrap">
							{request.description}
						</p>
					</DetailGroup>

					<Separator />

					<DetailGroup title="Receipt">
						<Detail
							label="File"
							value={request.receipt_filename ?? "No file"}
						/>
						{hasReceiptEndpoint(request) && (
							<div className="flex flex-col gap-2 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isOpeningReceipt}
									onClick={onViewReceipt}
								>
									<ExternalLink className="size-4" />
									{isOpeningReceipt ? "Opening..." : "View receipt"}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isDownloadingReceipt}
									onClick={onDownloadReceipt}
								>
									<Download className="size-4" />
									{isDownloadingReceipt ? "Downloading..." : "Download receipt"}
								</Button>
							</div>
						)}
					</DetailGroup>
				</DialogContent>
			)}
		</Dialog>
	);
}

function PaymentDetails({
	request,
}: {
	request: ReimbursementRequest;
}): React.ReactElement {
	if (!reimbursementRequiresPayout(request.submission_type)) {
		return (
			<DetailGroup title="Payment">
				<Detail label="Payout" value="No payment required" strong />
			</DetailGroup>
		);
	}

	// The member list only carries a bank name when the server adds one.
	const bankName = request.bank_name ?? request.payment_bank_name;
	return (
		<DetailGroup title="Payment">
			{bankName && <Detail label="Bank" value={bankName} />}
			<Detail label="IBAN" value={getMaskedPaymentIban(request)} monospace />
			<Detail label="BIC" value={getPaymentBic(request)} monospace />
			{request.payment_status && (
				<Detail
					label="Payment status"
					value={formatReviewStatus(request.payment_status)}
				/>
			)}
		</DetailGroup>
	);
}

function getStatusTone(request: ReimbursementRequest): BadgeVariant {
	const label = getStatusLabel(request);
	if (label === "Not approved") return "danger";
	if (label === "Paid") return "success";
	if (label === "Pending") return "warning";
	return "accent";
}
