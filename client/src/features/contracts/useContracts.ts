import type { ContractWorkflowStatus } from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiBlob, apiClient } from "../../lib/apiClient";

export type ContractVariableDataType =
	| "TEXT"
	| "TEXTAREA"
	| "NUMBER"
	| "DATE"
	| "BOOLEAN"
	| "SELECT"
	| "FILE";

export type ContractConditionType = "ALWAYS" | "IF_YES" | "IF_NO" | "IF_VALUE";

export type ContractSubmissionStatus = ContractWorkflowStatus;

export type ContractSubmissionReviewStatus = Exclude<
	ContractSubmissionStatus,
	"sent_to_partner" | "partner_comments" | "partner_signed" | "board_signed"
>;

export interface ContractTemplate {
	id: string;
	name: string;
	description: string | null;
	contract_text: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ContractTemplateVariable {
	id: string;
	template_id: string;
	variable_name: string;
	label: string;
	data_type: ContractVariableDataType;
	help_text: string | null;
	options: string[] | null;
	is_required: boolean;
	is_multiselect: boolean;
	show_if_variable: string | null;
	show_if_value: string | null;
	sort_order: number;
}

export interface ContractConditionalBlock {
	id: string;
	template_id: string;
	name: string;
	condition_type: ContractConditionType;
	condition_variable: string | null;
	condition_value: string | null;
	block_text: string;
	sort_order: number;
}

export interface ContractTemplateDetail {
	template: ContractTemplate;
	variables: ContractTemplateVariable[];
	blocks: ContractConditionalBlock[];
}

export interface RenderedContractDocument {
	text: string;
	html: string;
	pages: string[];
}

export interface ContractSubmission {
	id: string;
	template_id: string;
	submitter_user_id: string;
	form_data: Record<string, unknown>;
	generated_contract_text: string | null;
	admin_edited_text: string | null;
	status: ContractSubmissionStatus;
	notes: string | null;
	feedback_message: string | null;
	signature_token: string | null;
	signature_token_expires_at: string | null;
	signature_data: string | null;
	signer_name: string | null;
	signed_at: string | null;
	admin_signature_data: string | null;
	admin_signer_name: string | null;
	admin_signed_at: string | null;
	partner_comment: string | null;
	partner_commented_at: string | null;
	sent_to_partner_at: string | null;
	partner_email_sent_at: string | null;
	partner_email_recipient: string | null;
	partner_email_error: string | null;
	clarification_email_sent_at: string | null;
	clarification_email_recipient: string | null;
	clarification_email_error: string | null;
	signature_provider: "in_app" | "opensign";
	opensign_document_id: string | null;
	opensign_status: string | null;
	opensign_sent_at: string | null;
	opensign_completed_at: string | null;
	opensign_file_url: string | null;
	opensign_certificate_url: string | null;
	opensign_error: string | null;
	final_pdf_token: string | null;
	final_pdf_sent_at: string | null;
	completed_at: string | null;
	active_document_version_id: string | null;
	sent_document_version_id: string | null;
	final_document_version_id: string | null;
	submitted_at: string;
	created_at: string;
	updated_at: string;
}

export interface ContractPartnerComment {
	id: string;
	submission_id: string;
	author_type: "partner" | "internal";
	author_name: string | null;
	author_email: string | null;
	comment: string;
	document_version_id: string | null;
	created_at: string;
}

export interface PublicContractPartnerComment {
	author_type: "partner" | "internal";
	author_name: string | null;
	comment: string;
	created_at: string;
}

export interface PublicSignPayload {
	contract_text: string;
	html: string;
	pages: string[];
	status: ContractSubmissionStatus;
	comments: PublicContractPartnerComment[];
}

const TEMPLATES_QUERY_KEY = ["contract-templates"] as const;
const SUBMISSIONS_QUERY_KEY = ["contract-submissions"] as const;

function saveBlob(blob: Blob, filename: string): void {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(url);
}

export async function downloadContractSubmissionPdf(
	submissionId: string,
): Promise<void> {
	const blob = await apiBlob(`/api/contracts/submissions/${submissionId}/pdf`);
	saveBlob(blob, `contract-${submissionId}.pdf`);
}

export function useContractTemplates() {
	return useQuery({
		queryKey: TEMPLATES_QUERY_KEY,
		queryFn: () => apiClient<ContractTemplate[]>("/api/contracts/templates"),
	});
}

export function useContractTemplate(templateId: string | undefined) {
	return useQuery({
		queryKey: ["contract-template", templateId],
		enabled: Boolean(templateId),
		staleTime: 30_000,
		queryFn: () =>
			apiClient<ContractTemplateDetail>(
				`/api/contracts/templates/${templateId}`,
			),
	});
}

export function useContractPreview(
	templateId: string | undefined,
	formData: Record<string, unknown>,
) {
	return useQuery({
		queryKey: ["contract-preview", templateId, formData],
		enabled: Boolean(templateId),
		staleTime: 5_000,
		queryFn: () =>
			apiClient<RenderedContractDocument>(
				`/api/contracts/templates/${templateId}/preview`,
				{
					method: "POST",
					body: JSON.stringify({ form_data: formData }),
				},
			),
	});
}

export function useCreateContractTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			name: string;
			description?: string | null;
			contract_text?: string;
			is_active?: boolean;
		}) =>
			apiClient<ContractTemplate>("/api/contracts/templates", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY }),
	});
}

export function useUpdateContractTemplate(templateId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (
			body: Partial<{
				name: string;
				description: string | null;
				contract_text: string;
				is_active: boolean;
			}>,
		) =>
			apiClient<ContractTemplate>(`/api/contracts/templates/${templateId}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
			qc.invalidateQueries({ queryKey: ["contract-template", templateId] });
		},
	});
}

export function useDeleteContractTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (templateId: string) =>
			apiClient<void>(`/api/contracts/templates/${templateId}`, {
				method: "DELETE",
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY }),
	});
}

export function useCreateVariable(templateId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: Omit<ContractTemplateVariable, "id" | "template_id">) =>
			apiClient<ContractTemplateVariable>(
				`/api/contracts/templates/${templateId}/variables`,
				{ method: "POST", body: JSON.stringify(body) },
			),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["contract-template", templateId] }),
	});
}

export function useDeleteVariable(templateId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variableId: string) =>
			apiClient<void>(
				`/api/contracts/templates/${templateId}/variables/${variableId}`,
				{ method: "DELETE" },
			),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["contract-template", templateId] }),
	});
}

export function useCreateBlock(templateId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: Omit<ContractConditionalBlock, "id" | "template_id">) =>
			apiClient<ContractConditionalBlock>(
				`/api/contracts/templates/${templateId}/blocks`,
				{ method: "POST", body: JSON.stringify(body) },
			),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["contract-template", templateId] }),
	});
}

export function useDeleteBlock(templateId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (blockId: string) =>
			apiClient<void>(
				`/api/contracts/templates/${templateId}/blocks/${blockId}`,
				{ method: "DELETE" },
			),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["contract-template", templateId] }),
	});
}

export function useContractSubmissions() {
	return useQuery({
		queryKey: SUBMISSIONS_QUERY_KEY,
		queryFn: () =>
			apiClient<ContractSubmission[]>("/api/contracts/submissions"),
	});
}

export function useContractSubmission(id: string | undefined) {
	return useQuery({
		queryKey: ["contract-submission", id],
		enabled: Boolean(id),
		queryFn: () =>
			apiClient<ContractSubmission>(`/api/contracts/submissions/${id}`),
	});
}

export function useContractSubmissionPreview(
	id: string | undefined,
	contractText: string,
) {
	return useQuery({
		queryKey: ["contract-submission-preview", id, contractText],
		enabled: Boolean(id),
		staleTime: 5_000,
		queryFn: () =>
			apiClient<RenderedContractDocument>(
				`/api/contracts/submissions/${id}/preview`,
				{
					method: "POST",
					body: JSON.stringify({ contract_text: contractText }),
				},
			),
	});
}

export function useCreateContractSubmission() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			template_id: string;
			form_data: Record<string, unknown>;
			status?: "draft" | "submitted";
		}) =>
			apiClient<ContractSubmission>("/api/contracts/submissions", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY }),
	});
}

export function useUpdateContractDraft(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			form_data: Record<string, unknown>;
			status?: "draft" | "submitted";
		}) =>
			apiClient<ContractSubmission>(`/api/contracts/submissions/${id}/draft`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
			qc.invalidateQueries({ queryKey: ["contract-submission", id] });
		},
	});
}

export function useUpdateContractSubmission(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			status?: ContractSubmissionReviewStatus;
			admin_edited_text?: string | null;
			notes?: string | null;
			feedback_message?: string | null;
			generate_signature_token?: boolean;
			send_to_partner?: boolean;
			send_partner_email?: boolean;
			send_opensign?: boolean;
			partner_email_subject?: string | null;
			partner_email_message?: string | null;
			signature_token_ttl_hours?: number;
		}) =>
			apiClient<ContractSubmission>(`/api/contracts/submissions/${id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
			qc.invalidateQueries({ queryKey: ["contract-submission", id] });
		},
	});
}

export function useContractSubmissionComments(id: string | undefined) {
	return useQuery({
		queryKey: ["contract-submission-comments", id],
		enabled: Boolean(id),
		queryFn: () =>
			apiClient<ContractPartnerComment[]>(
				`/api/contracts/submissions/${id}/comments`,
			),
	});
}

export function useCreateContractSubmissionComment(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { comment: string }) =>
			apiClient<ContractPartnerComment>(
				`/api/contracts/submissions/${id}/comments`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["contract-submission-comments", id] });
			qc.invalidateQueries({ queryKey: ["contract-submission", id] });
		},
	});
}

export function useBoardSignContractSubmission(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { signature_data: string; signer_name: string }) =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${id}/board-signature`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
			qc.invalidateQueries({ queryKey: ["contract-submission", id] });
		},
	});
}

export function useFinalizeContractSubmission(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiClient<ContractSubmission>(
				`/api/contracts/submissions/${id}/finalize`,
				{ method: "POST" },
			),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: SUBMISSIONS_QUERY_KEY });
			qc.invalidateQueries({ queryKey: ["contract-submission", id] });
		},
	});
}

// Public — no auth required. Uses raw fetch so we don't attach a bearer
// token (the partner is not logged in).
export async function fetchPublicSignPayload(
	token: string,
): Promise<PublicSignPayload> {
	const res = await fetch(`/api/contracts/sign/${encodeURIComponent(token)}`);
	if (!res.ok) {
		const message =
			(await res.json().catch(() => ({})))?.error ?? res.statusText;
		throw new Error(message);
	}
	return res.json();
}

export async function postPublicSignature(
	token: string,
	body: { signature_data: string; signer_name: string },
): Promise<void> {
	const res = await fetch(`/api/contracts/sign/${encodeURIComponent(token)}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const message =
			(await res.json().catch(() => ({})))?.error ?? res.statusText;
		throw new Error(message);
	}
}

export async function postPublicComment(
	token: string,
	body: { comment: string },
): Promise<void> {
	const res = await fetch(
		`/api/contracts/sign/${encodeURIComponent(token)}/comment`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
	);
	if (!res.ok) {
		const message =
			(await res.json().catch(() => ({})))?.error ?? res.statusText;
		throw new Error(message);
	}
}
