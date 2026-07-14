import type {
	ContractConditionalBlock,
	ContractTemplate,
	ContractTemplateDetail,
	ContractTemplateVariable,
	RenderedContractDocument,
} from "@member-manager/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contractQueryKeys } from "@/features/contracts/contractQueryKeys";
import { apiClient } from "@/lib/apiClient";

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
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: contractQueryKeys.templates,
			}),
	});
}

export function useUpdateContractTemplate(templateId: string) {
	const queryClient = useQueryClient();
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
		mutationFn: (body: Omit<ContractTemplateVariable, "id" | "template_id">) =>
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
		mutationFn: (body: Omit<ContractConditionalBlock, "id" | "template_id">) =>
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
