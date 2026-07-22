import type {
	FinanceReallocationRequest,
	FinanceReallocationStatus,
} from "@member-manager/shared";
import { Check, Loader2, X } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	formatFinanceAmount,
	formatFinanceDate,
} from "@/features/finance/financeUtils";
import type { ReallocationReviewInput } from "@/features/finance/hooks/useFinanceManagement";

const STATUS_LABELS: Record<FinanceReallocationStatus, string> = {
	pending: "Offen",
	approved: "Genehmigt",
	rejected: "Abgelehnt",
};

const STATUS_VARIANTS: Record<FinanceReallocationStatus, BadgeVariant> = {
	pending: "warning",
	approved: "success",
	rejected: "danger",
};

interface FinanceReallocationQueueProps {
	requests: FinanceReallocationRequest[];
	canManage: boolean;
	reviewingRequestId: string | null;
	onReview: (input: ReallocationReviewInput) => Promise<void>;
}

export function FinanceReallocationQueue({
	requests,
	canManage,
	reviewingRequestId,
	onReview,
}: FinanceReallocationQueueProps): ReactElement {
	return (
		<section
			aria-labelledby="reallocation-queue-heading"
			className="overflow-hidden rounded-md border bg-card shadow-sm"
		>
			<div className="border-b px-4 py-3">
				<h3 id="reallocation-queue-heading" className="text-sm font-semibold">
					Umverteilungsanfragen
				</h3>
				<p className="text-xs text-muted-foreground">
					{requests.filter((request) => request.status === "pending").length}{" "}
					offen · {requests.length} gesamt
				</p>
			</div>
			{requests.length === 0 ? (
				<p className="p-4 text-sm text-muted-foreground">
					Keine Umverteilungsanfragen vorhanden.
				</p>
			) : (
				<div className="divide-y">
					{requests.map((request) => (
						<ReallocationRow
							key={request.id}
							request={request}
							canManage={canManage}
							isReviewing={reviewingRequestId === request.id}
							onReview={onReview}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function ReallocationRow({
	request,
	canManage,
	isReviewing,
	onReview,
}: {
	request: FinanceReallocationRequest;
	canManage: boolean;
	isReviewing: boolean;
	onReview: (input: ReallocationReviewInput) => Promise<void>;
}): ReactElement {
	const [reviewNote, setReviewNote] = useState("");

	async function review(decision: "approved" | "rejected"): Promise<void> {
		const succeeded = await onReview({
			requestId: request.id,
			review: {
				decision,
				review_note: reviewNote.trim() || null,
			},
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			setReviewNote("");
		}
	}

	return (
		<div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium">{request.requesting_department}</span>
					<Badge variant={STATUS_VARIANTS[request.status]}>
						{STATUS_LABELS[request.status]}
					</Badge>
					<span className="text-xs text-muted-foreground">
						{formatFinanceDate(request.created_at)}
					</span>
				</div>
				<p className="mt-1 text-sm">{request.reason}</p>
				<p className="mt-1 truncate text-xs text-muted-foreground">
					Buchung {request.posting_external_id}
				</p>
				<ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
					{request.allocations.map((allocation) => (
						<li
							key={allocation.id}
							className="flex flex-wrap justify-between gap-2"
						>
							<span>{allocation.department ?? "Ohne Department"}</span>
							<span className="tabular-nums">
								{allocation.allocated_percentage.toLocaleString("de-DE")} % ·{" "}
								{formatFinanceAmount(allocation.allocated_amount)}
							</span>
						</li>
					))}
				</ul>
				{request.review_note ? (
					<p className="mt-2 text-xs text-muted-foreground">
						Review: {request.review_note}
					</p>
				) : null}
			</div>

			{canManage && request.status === "pending" ? (
				<div className="grid content-start gap-2">
					<Input
						value={reviewNote}
						onChange={(event) => setReviewNote(event.target.value)}
						placeholder="Review-Notiz (optional)"
						aria-label={`Review-Notiz für ${request.requesting_department}`}
					/>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							disabled={isReviewing}
							className="bg-[#9A64D9] text-white hover:bg-[#523573]"
							onClick={() => {
								void review("approved");
							}}
						>
							{isReviewing ? <Loader2 className="animate-spin" /> : <Check />}
							Genehmigen
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isReviewing}
							onClick={() => {
								void review("rejected");
							}}
						>
							<X />
							Ablehnen
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
