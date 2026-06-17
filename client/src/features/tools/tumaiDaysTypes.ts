export interface TumaiDayEvent {
	id: string;
	agenda: string;
	scheduled_at: string;
	sent_at: string | null;
	created_at: string;
}

export interface RSVPResponse {
	userId: string;
	givenName: string;
	surname: string;
	email: string;
	department: string;
	status: "yes" | "no" | "pending";
	reason: string | null;
	votedAt: string | null;
}

export interface EventResponsesPayload {
	event: TumaiDayEvent;
	stats: {
		yes: number;
		no: number;
		pending: number;
		total: number;
	};
	responses: RSVPResponse[];
}

export type ResponseStatusFilter = "all" | "yes" | "no" | "pending";
