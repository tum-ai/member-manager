export const contractQueryKeys = {
	templates: ["contract-templates"] as const,
	template: (templateId: string | undefined) =>
		["contract-template", templateId] as const,
	preview: (
		templateId: string | undefined,
		formData: Record<string, unknown>,
	) => ["contract-preview", templateId, formData] as const,
	submissions: ["contract-submissions"] as const,
	submission: (submissionId: string | undefined) =>
		["contract-submission", submissionId] as const,
	statusEvents: (submissionId: string | undefined) =>
		["contract-status-events", submissionId] as const,
	submissionPreview: (submissionId: string | undefined, contractText: string) =>
		["contract-submission-preview", submissionId, contractText] as const,
	comments: (submissionId: string | undefined) =>
		["contract-submission-comments", submissionId] as const,
};
