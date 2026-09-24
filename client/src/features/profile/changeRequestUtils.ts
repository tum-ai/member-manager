import type { BadgeVariant } from "@/components/ui/badge";
import type { MemberChangeRequest } from "@/hooks/useMemberChangeRequests";
import {
	getMemberStatusLabel,
	resolveDepartmentForMemberRole,
} from "@/lib/memberMetadata";

// Member-facing view of a member's own change requests. Unlike the admin
// `formatRequestedChanges` (features/admin/adminRequests.tsx), this describes
// only what was requested, without a "current -> requested" diff, so it needs
// no members list.

export interface RequestedChangeEntry {
	label: string;
	value: string;
}

function nonEmpty(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed || null;
}

/**
 * Lists the fields a change request asks to change, in a stable display order
 * (role, department, status, degree, school, batch). A department is omitted
 * when the requested role has none (executives), mirroring how the server
 * compacts the request.
 */
export function describeRequestedChanges(
	changes: MemberChangeRequest["changes"],
): RequestedChangeEntry[] {
	const entries: RequestedChangeEntry[] = [];
	const role = nonEmpty(changes.member_role);
	const department = resolveDepartmentForMemberRole(
		role,
		nonEmpty(changes.department),
	);
	const status = nonEmpty(changes.member_status);

	if (role) entries.push({ label: "Role", value: role });
	if (department) entries.push({ label: "Department", value: department });
	if (status) {
		entries.push({ label: "Status", value: getMemberStatusLabel(status) });
	}

	const degree = nonEmpty(changes.degree);
	const school = nonEmpty(changes.school);
	const batch = nonEmpty(changes.batch);
	if (degree) entries.push({ label: "Degree", value: degree });
	if (school) entries.push({ label: "School", value: school });
	if (batch) entries.push({ label: "Batch", value: batch });

	return entries;
}

const STATUS_LABELS: Record<MemberChangeRequest["status"], string> = {
	pending: "Pending",
	approved: "Approved",
	rejected: "Rejected",
};

const STATUS_BADGE_VARIANTS: Record<
	MemberChangeRequest["status"],
	BadgeVariant
> = {
	pending: "warning",
	approved: "success",
	rejected: "danger",
};

export function getChangeRequestStatusLabel(
	status: MemberChangeRequest["status"],
): string {
	return STATUS_LABELS[status] ?? status;
}

export function getChangeRequestStatusBadgeVariant(
	status: MemberChangeRequest["status"],
): BadgeVariant {
	return STATUS_BADGE_VARIANTS[status] ?? "neutral";
}

/** Formats an ISO timestamp as e.g. "Apr 24, 2026"; null when missing/invalid. */
export function formatChangeRequestDate(value?: string | null): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

/**
 * Splits requests into pending and reviewed groups. Each group keeps the input
 * order, so an API list sorted newest-first stays newest-first.
 */
export function partitionChangeRequests(
	requests: readonly MemberChangeRequest[],
): { pending: MemberChangeRequest[]; reviewed: MemberChangeRequest[] } {
	const pending: MemberChangeRequest[] = [];
	const reviewed: MemberChangeRequest[] = [];
	for (const request of requests) {
		(request.status === "pending" ? pending : reviewed).push(request);
	}
	return { pending, reviewed };
}
