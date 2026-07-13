import type { BadgeVariant } from "@/components/ui/badge";
import type {
	ContractSubmissionReviewStatus,
	ContractSubmissionStatus,
} from "./useContracts";

/**
 * Statuses that Legal can set directly via the manual override dropdown
 * (round 2 Nr.7). Mirrors the server's REVIEW_STATUSES — partner/board
 * transitions stay exclusive to their dedicated endpoints.
 */
export const CONTRACT_REVIEW_STATUSES: ContractSubmissionReviewStatus[] = [
	"draft",
	"submitted",
	"legal_review",
	"in_review",
	"approved",
	"rejected",
	"inquiry",
	"signed",
	"completed",
];

export const CONTRACT_STATUS_LABELS: Record<ContractSubmissionStatus, string> =
	{
		draft: "Draft",
		submitted: "Submitted",
		legal_review: "Legal review",
		in_review: "In review",
		approved: "Approved",
		sent_to_partner: "Sent to partner",
		partner_comments: "Partner comments",
		partner_signed: "Partner signed",
		board_signed: "Board signed",
		rejected: "Rejected",
		inquiry: "Inquiry",
		signed: "Signed",
		completed: "Completed",
	};

export const CONTRACT_STATUS_TONE: Record<
	ContractSubmissionStatus,
	BadgeVariant
> = {
	draft: "neutral",
	submitted: "info",
	legal_review: "info",
	in_review: "info",
	approved: "accent",
	sent_to_partner: "accent",
	partner_comments: "warning",
	partner_signed: "success",
	board_signed: "success",
	rejected: "danger",
	inquiry: "warning",
	signed: "success",
	completed: "success",
};

export function getContractStatusLabel(
	status: ContractSubmissionStatus,
): string {
	return CONTRACT_STATUS_LABELS[status] ?? status;
}

export function getContractStatusTone(
	status: ContractSubmissionStatus,
): BadgeVariant {
	return CONTRACT_STATUS_TONE[status] ?? "neutral";
}
