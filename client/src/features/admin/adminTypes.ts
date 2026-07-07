import type {
	MemberDuplicateCandidate,
	MemberMergeRequest,
	MemberMergeResponse,
} from "@member-manager/shared";
import type { AdminMember } from "./adminUtils";

export type {
	MemberDuplicateCandidate,
	MemberMergeRequest,
	MemberMergeResponse,
};

export interface AdminResponse {
	data: AdminMember[];
	total: number;
	page: number;
	limit: number;
}

export interface MemberChangeRequest {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	reason?: string | null;
	review_note?: string | null;
	changes: {
		department?: string | null;
		member_role?: string | null;
		member_status?: string | null;
		degree?: string | null;
		school?: string | null;
		batch?: string | null;
	};
}

export interface EngagementCertificateRequest {
	id: string;
	user_id: string;
	status: "pending" | "approved" | "rejected";
	review_note?: string | null;
	engagements: Array<Record<string, unknown>>;
}

export interface JobPostingRequest {
	id: string;
	source?: "member_manager" | "partner_portal";
	user_id: string;
	status: "pending" | "approved" | "rejected";
	title: string;
	organization_name: string;
	logo_url?: string | null;
	description_markdown: string;
	call_to_action?: string | null;
	job_type: string;
	location: string;
	contact_name: string;
	contact_email: string;
	contact_role?: string | null;
	external_url?: string | null;
	expires_at?: string | null;
	published_at?: string | null;
	review_note?: string | null;
	created_at?: string;
}
