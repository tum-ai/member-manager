import type {
	ContractConditionalBlock,
	ContractConditionalBlockInput,
	ContractDocxReadiness,
	ContractTemplate,
	ContractTemplateDetail,
	ContractTemplateDocument,
	ContractTemplateInput,
	ContractTemplateVariable,
	ContractTemplateVariableInput,
	RenderedContractDocument,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contractQueryKeys } from "@/features/contracts/contractQueryKeys";
import { apiBlob, apiClient } from "@/lib/apiClient";

type ContractTemplateDetailWithDocuments = ContractTemplateDetail & {
	documents?: ContractTemplateDocument[];
};

function hasPendingDocuments(detail: unknown): boolean {
	const documents = (detail as ContractTemplateDetailWithDocuments | undefined)
		?.documents;
	return Boolean(
		documents?.some(
			(document) =>
				document.status === "queued" || document.status === "processing",
		),
	);
}

export function useContractTemplates() {
	return useQuery({
		queryKey: contractQueryKeys.templates,
		queryFn: () => apiClient<ContractTemplate[]>("/api/contracts/templates"),
	});
}

export function useContractTemplate(templateId: string | undefined) {
	return useQuery({
		queryKey: contractQueryKeys.template(templateId),
		enabled: Boolean(templateId),
		staleTime: 30_000,
		refetchInterval: (query) =>
			hasPendingDocuments(query.state.data) ? 2_000 : false,
		queryFn: () =>
			apiClient<ContractTemplateDetail>(
				`/api/contracts/templates/${templateId}`,
			),
	});
}

export function useContractDocxReadiness() {
	return useQuery({
		queryKey: contractQueryKeys.docxReadiness,
		queryFn: () =>
			apiClient<ContractDocxReadiness>("/api/contracts/docx-readiness"),
	});
}

export function useContractTemplateDocumentPdf(
	templateId: string | undefined,
	documentId: string | undefined,
) {
	return useQuery({
		queryKey: contractQueryKeys.templateDocumentPdf(templateId, documentId),
		enabled: Boolean(templateId && documentId),
		queryFn: () =>
			apiBlob(
				`/api/contracts/templates/${templateId}/documents/${documentId}/preview.pdf`,
			),
	});
}

export function useUploadContractTemplateDocument(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (file: File) => {
			const body = new FormData();
			body.append("file", file);
			return apiClient<ContractTemplateDocument>(
				`/api/contracts/templates/${templateId}/documents`,
				{ method: "POST", body },
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.docxReadiness,
			});
		},
	});
}

export function useRetryContractTemplateDocument(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (documentId: string) =>
			apiClient<ContractTemplateDocument>(
				`/api/contracts/templates/${templateId}/documents/${documentId}/retry`,
				{ method: "POST", body: JSON.stringify({ force: true }) },
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.docxReadiness,
			});
		},
	});
}

export function useActivateContractTemplateDocument(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (documentId: string) =>
			apiClient<ContractTemplate>(
				`/api/contracts/templates/${templateId}/documents/${documentId}/activate`,
				{ method: "POST" },
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.templates,
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.docxReadiness,
			});
		},
	});
}

export function useEnableContractDocxCutover() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (enabled: boolean) =>
			apiClient<{ enabled: boolean }>("/api/contracts/docx-cutover", {
				method: "POST",
				body: JSON.stringify({ enabled, confirm: true }),
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.docxReadiness,
			}),
	});
}

export function useContractPreview(
	templateId: string | undefined,
	formData: Record<string, unknown>,
) {
	return useQuery({
		queryKey: contractQueryKeys.preview(templateId, formData),
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
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ContractTemplateInput) =>
			apiClient<ContractTemplate>("/api/contracts/templates", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.templates,
			}),
	});
}

export function useUpdateContractTemplate(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: Partial<ContractTemplateInput>) =>
			apiClient<ContractTemplate>(`/api/contracts/templates/${templateId}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.templates,
			});
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			});
		},
	});
}

export function useDeleteContractTemplate() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (templateId: string) =>
			apiClient<void>(`/api/contracts/templates/${templateId}`, {
				method: "DELETE",
			}),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.templates,
			}),
	});
}

export function useCreateVariable(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ContractTemplateVariableInput) =>
			apiClient<ContractTemplateVariable>(
				`/api/contracts/templates/${templateId}/variables`,
				{ method: "POST", body: JSON.stringify(body) },
			),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			}),
	});
}

export function useDeleteVariable(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (variableId: string) =>
			apiClient<void>(
				`/api/contracts/templates/${templateId}/variables/${variableId}`,
				{ method: "DELETE" },
			),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			}),
	});
}

export function useCreateBlock(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ContractConditionalBlockInput) =>
			apiClient<ContractConditionalBlock>(
				`/api/contracts/templates/${templateId}/blocks`,
				{ method: "POST", body: JSON.stringify(body) },
			),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			}),
	});
}

export function useDeleteBlock(templateId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (blockId: string) =>
			apiClient<void>(
				`/api/contracts/templates/${templateId}/blocks/${blockId}`,
				{ method: "DELETE" },
			),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.template(templateId),
			}),
	});
}
