export const contractQueryKeys = {
	templates: ["contract-templates"] as const,
	template: (templateId: string | undefined) =>
		["contract-template", templateId] as const,
	templateDocumentPdf: (
		templateId: string | undefined,
		documentId: string | undefined,
	) => ["contract-template-document-pdf", templateId, documentId] as const,
	docxReadiness: ["contract-docx-readiness"] as const,
	submissions: ["contract-submissions"] as const,
	submission: (submissionId: string | undefined) =>
		["contract-submission", submissionId] as const,
	statusEvents: (submissionId: string | undefined) =>
		["contract-status-events", submissionId] as const,
	submissionPdf: (submissionId: string | undefined) =>
		["contract-submission-pdf", submissionId] as const,
	comments: (submissionId: string | undefined) =>
		["contract-submission-comments", submissionId] as const,
	publicSign: (token: string | undefined) =>
		["contract-public-sign", token] as const,
	publicSignPdf: (token: string | undefined) =>
		["contract-public-sign-pdf", token] as const,
	publicBoardSign: (token: string | undefined) =>
		["contract-public-board-sign", token] as const,
	publicBoardSignPdf: (token: string | undefined) =>
		["contract-public-board-sign-pdf", token] as const,
};
