import type {
	ContractTemplate,
	ContractTemplateDetail,
} from "@member-manager/shared";
import { useEffect, useState } from "react";
import type {
	ContractTemplateDraft,
	ContractTemplatesPageViewModel,
} from "@/features/contracts/contractTemplatesPageTypes";
import {
	useContractTemplate,
	useContractTemplates,
	useCreateBlock,
	useCreateContractTemplate,
	useCreateVariable,
	useDeleteBlock,
	useDeleteContractTemplate,
	useDeleteVariable,
	useUpdateContractTemplate,
} from "./useContractTemplates";

function draftFromDetail(
	detail: ContractTemplateDetail,
): ContractTemplateDraft {
	return {
		name: detail.template.name,
		description: detail.template.description ?? "",
		contract_text: detail.template.contract_text,
		is_active: detail.template.is_active,
	};
}

function draftDiffersFromDetail(
	draft: ContractTemplateDraft | null,
	detail: ContractTemplateDetail | undefined,
): boolean {
	if (!detail || !draft) return false;
	return (
		detail.template.name !== draft.name ||
		(detail.template.description ?? "") !== draft.description ||
		detail.template.contract_text !== draft.contract_text ||
		detail.template.is_active !== draft.is_active
	);
}

export function useContractTemplatesPage(): ContractTemplatesPageViewModel {
	const templatesQuery = useContractTemplates();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newTemplateOpen, setNewTemplateOpen] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(
		null,
	);
	const [draft, setDraft] = useState<ContractTemplateDraft | null>(null);
	const [deleteVariableId, setDeleteVariableId] = useState<string | null>(null);
	const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

	const createTemplateMutation = useCreateContractTemplate();
	const deleteTemplateMutation = useDeleteContractTemplate();
	const detailQuery = useContractTemplate(selectedId ?? undefined);
	const updateTemplateMutation = useUpdateContractTemplate(selectedId ?? "");
	const createVariableMutation = useCreateVariable(selectedId ?? "");
	const deleteVariableMutation = useDeleteVariable(selectedId ?? "");
	const createBlockMutation = useCreateBlock(selectedId ?? "");
	const deleteBlockMutation = useDeleteBlock(selectedId ?? "");

	useEffect(() => {
		if (!selectedId && templatesQuery.data && templatesQuery.data.length > 0) {
			setSelectedId(templatesQuery.data[0].id);
		}
	}, [selectedId, templatesQuery.data]);

	useEffect(() => {
		if (detailQuery.data) {
			setDraft(draftFromDetail(detailQuery.data));
		}
	}, [detailQuery.data]);

	const templates = templatesQuery.data ?? [];
	const detail = detailQuery.data;

	return {
		templates,
		templatesLoading: templatesQuery.isLoading,
		templatesError: templatesQuery.error,
		selectedId,
		selectedTemplate: templates.find((item) => item.id === selectedId),
		listOpen,
		newTemplateOpen,
		deleteTarget,
		createTemplatePending: createTemplateMutation.isPending,
		createTemplateError: createTemplateMutation.error,
		deleteTemplateError: deleteTemplateMutation.error,
		editor: {
			detail,
			loading: detailQuery.isLoading || !detail || !draft,
			error: detailQuery.error,
			draft,
			dirty: draftDiffersFromDetail(draft, detail),
			updatePending: updateTemplateMutation.isPending,
			updateError: updateTemplateMutation.error,
			deleteVariableId,
			deleteBlockId,
			createVariablePending: createVariableMutation.isPending,
			createVariableError: createVariableMutation.error,
			createBlockPending: createBlockMutation.isPending,
			createBlockError: createBlockMutation.error,
			setDraft,
			save: () => {
				if (!draft) return;
				updateTemplateMutation.mutate({
					name: draft.name,
					description: draft.description || null,
					contract_text: draft.contract_text,
					is_active: draft.is_active,
				});
			},
			discard: () => {
				if (detail) setDraft(draftFromDetail(detail));
			},
			createVariable: (values) => createVariableMutation.mutate(values),
			createBlock: (values) => createBlockMutation.mutate(values),
			setDeleteVariableId,
			setDeleteBlockId,
			deleteVariable: () => {
				if (deleteVariableId) {
					deleteVariableMutation.mutate(deleteVariableId);
				}
			},
			deleteBlock: () => {
				if (deleteBlockId) deleteBlockMutation.mutate(deleteBlockId);
			},
		},
		setListOpen,
		setNewTemplateOpen,
		setDeleteTarget,
		selectTemplate: (id) => {
			setSelectedId(id);
			setListOpen(false);
		},
		createTemplate: (name) =>
			createTemplateMutation.mutate(
				{ name, contract_text: "", is_active: true },
				{
					onSuccess: (template) => {
						setSelectedId(template.id);
						setNewTemplateOpen(false);
					},
				},
			),
		deleteTemplate: () => {
			if (!deleteTarget) return;
			const targetId = deleteTarget.id;
			deleteTemplateMutation.mutate(targetId, {
				onSuccess: () => {
					if (selectedId === targetId) setSelectedId(null);
				},
			});
		},
	};
}
