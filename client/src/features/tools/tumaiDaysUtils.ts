import type {
	EventResponsesPayload,
	ResponseStatusFilter,
	RSVPResponse,
} from "./tumaiDaysTypes";

/** Format an ISO timestamp for display in the events list / sent badge. */
export function formatDate(isoString: string): string {
	const d = new Date(isoString);
	return d.toLocaleString("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

/**
 * Convert an ISO `scheduled_at` into the local `YYYY-MM-DDTHH:MM` format that a
 * `datetime-local` input expects.
 */
export function toLocalDateTimeInput(isoString: string): string {
	const d = new Date(isoString);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Filter RSVP responses by free-text search (name/email) and status. */
export function filterResponses(
	responses: RSVPResponse[],
	searchTerm: string,
	statusFilter: ResponseStatusFilter,
): RSVPResponse[] {
	return responses.filter((r) => {
		const name = `${r.givenName} ${r.surname}`.toLowerCase();
		const matchesSearch =
			name.includes(searchTerm.toLowerCase()) ||
			r.email.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesFilter = statusFilter === "all" || r.status === statusFilter;
		return matchesSearch && matchesFilter;
	});
}

/**
 * Share of active members who have responded (yes or no) so far, rounded to a
 * whole percentage. Returns 0 when there are no members.
 */
export function computeResponseRate(
	stats: EventResponsesPayload["stats"] | undefined,
): number {
	return stats && stats.total > 0
		? Math.round(((stats.yes + stats.no) / stats.total) * 100)
		: 0;
}
