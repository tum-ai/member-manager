import type {
	JobPostingRequest,
	MemberDuplicateCandidate,
	MemberMergeRequest,
	MemberMergeResponse,
} from "@member-manager/shared";
import type { AdminMember } from "./adminUtils";

export type {
	JobPostingRequest,
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
