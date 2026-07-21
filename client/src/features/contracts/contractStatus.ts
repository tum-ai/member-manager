import type {
	ContractReviewStatus,
	ContractWorkflowStatus,
} from "@member-manager/shared";
import type { BadgeVariant } from "@/components/ui/badge";

export const CONTRACT_MANUAL_STATUSES = [
	"submitted",
	"legal_review",
	"in_review",
	"inquiry",
	"approved",
] as const satisfies readonly ContractReviewStatus[];

export const CONTRACT_STATUS_LABELS: Record<ContractWorkflowStatus, string> = {
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
	ContractWorkflowStatus,
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

export function getContractStatusLabel(status: ContractWorkflowStatus): string {
	return CONTRACT_STATUS_LABELS[status] ?? status;
}

export function getContractStatusTone(
	status: ContractWorkflowStatus,
): BadgeVariant {
	return CONTRACT_STATUS_TONE[status] ?? "neutral";
}
