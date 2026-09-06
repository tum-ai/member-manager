import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Generic status → Badge tone mapping shared across features, so a "pending" or
 * "approved" badge reads the same everywhere. Domain flows with their own
 * nuanced ramps (e.g. contracts' multi-stage pipeline) keep their dedicated
 * maps; this covers the many ad-hoc status badges.
 */
const STATUS_TONE: Record<string, BadgeVariant> = {
	// settled / positive
	approved: "success",
	accepted: "success",
	active: "success",
	confirmed: "success",
	completed: "success",
	signed: "success",
	paid: "success",
	succeeded: "success",
	success: "success",
	// in flight / informational
	submitted: "info",
	in_review: "info",
	review: "info",
	processing: "info",
	queued: "info",
	requested: "info",
	// awaiting action
	pending: "warning",
	inquiry: "warning",
	to_be_paid: "warning",
	// inert
	draft: "neutral",
	cancelled: "neutral",
	canceled: "neutral",
	expired: "neutral",
	archived: "neutral",
	inactive: "neutral",
	alumni: "neutral",
	withdrawn: "neutral",
	not_synced: "neutral",
	// negative
	rejected: "danger",
	declined: "danger",
	failed: "danger",
	not_approved: "danger",
	error: "danger",
};

/** Map a status label or key to a semantic Badge variant (falls back to neutral). */
export function statusTone(status: string): BadgeVariant {
	const key = status
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	return STATUS_TONE[key] ?? "neutral";
}
