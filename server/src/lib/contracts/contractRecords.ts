import {
	ContractSubmissionCreatorDetailSchema,
	ContractSubmissionCreatorSummarySchema,
	type PublicContractPartnerComment,
} from "@member-manager/shared";

export function toCreatorSubmissionSummary(
	submission: Record<string, unknown>,
): Record<string, unknown> {
	return ContractSubmissionCreatorSummarySchema.parse(submission);
}

export function toCreatorSubmissionDetail(
	submission: Record<string, unknown>,
): Record<string, unknown> {
	return ContractSubmissionCreatorDetailSchema.parse(submission);
}

function getSubmissionFormString(
	submission: Record<string, unknown>,
	key: string,
): string {
	const formData =
		typeof submission.form_data === "object" && submission.form_data !== null
			? (submission.form_data as Record<string, unknown>)
			: {};
	const value = formData[key];
	return typeof value === "string" ? value.trim() : "";
}

export function getPartnerEmailFromSubmission(
	submission: Record<string, unknown>,
): string {
	return getSubmissionFormString(submission, "partner_contact_email");
}

export function getPartnerCompanyNameFromSubmission(
	submission: Record<string, unknown>,
): string {
	return getSubmissionFormString(submission, "partner_company_name");
}

function sanitizePublicComment(
	comment: Record<string, unknown>,
): PublicContractPartnerComment {
	return {
		author_type:
			comment.author_type === "internal" || comment.author_type === "partner"
				? comment.author_type
				: "partner",
		author_name:
			comment.author_type === "internal"
				? "TUM.ai"
				: typeof comment.author_name === "string" && comment.author_name.trim()
					? comment.author_name
					: "Partner",
		comment: typeof comment.comment === "string" ? comment.comment : "",
		created_at:
			typeof comment.created_at === "string" && comment.created_at
				? comment.created_at
				: new Date(0).toISOString(),
	};
}

function legacyPartnerCommentForPublicHistory(
	submission: Record<string, unknown>,
): PublicContractPartnerComment | null {
	const comment =
		typeof submission.partner_comment === "string"
			? submission.partner_comment.trim()
			: "";
	if (!comment) return null;
	return sanitizePublicComment({
		author_type: "partner",
		author_name: getPartnerCompanyNameFromSubmission(submission) || "Partner",
		comment,
		created_at:
			typeof submission.partner_commented_at === "string"
				? submission.partner_commented_at
				: typeof submission.updated_at === "string"
					? submission.updated_at
					: typeof submission.submitted_at === "string"
						? submission.submitted_at
						: new Date(0).toISOString(),
	});
}

export function buildPublicCommentHistory(
	submission: Record<string, unknown>,
	comments: Array<Record<string, unknown>>,
): PublicContractPartnerComment[] {
	const publicComments = comments
		.filter((comment) => comment.author_type !== "internal")
		.map(sanitizePublicComment);
	const legacyComment = legacyPartnerCommentForPublicHistory(submission);
	if (
		legacyComment &&
		!publicComments.some(
			(comment) =>
				comment.author_type === "partner" &&
				comment.comment === legacyComment.comment,
		)
	) {
		publicComments.unshift(legacyComment);
	}
	return publicComments;
}
