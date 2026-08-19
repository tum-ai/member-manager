import type {
	ContractTemplate,
	ContractTemplateDetail,
	ContractTemplateDocument,
} from "@member-manager/shared";
import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import type {
	ContractTemplateDraft,
	ContractTemplatesPageViewModel,
} from "@/features/contracts/contractTemplatesPageTypes";
import { useBlobObjectUrl } from "./useBlobObjectUrl";
import {
	useActivateContractTemplateDocument,
	useContractDocxReadiness,
	useContractTemplate,
	useContractTemplateDocumentPdf,
	useContractTemplates,
	useCreateBlock,
	useCreateContractTemplate,
	useCreateVariable,
	useDeleteBlock,
	useDeleteContractTemplate,
	useDeleteVariable,
	useEnableContractDocxCutover,
	useRetryContractTemplateDocument,
	useUpdateContractTemplate,
	useUploadContractTemplateDocument,
} from "./useContractTemplates";

type ContractTemplateDetailWithDocuments = ContractTemplateDetail & {
	documents?: ContractTemplateDocument[];
};

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
	const { showToast } = useToast();
	const templatesQuery = useContractTemplates();
	const readinessQuery = useContractDocxReadiness();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newTemplateOpen, setNewTemplateOpen] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(
		null,
	);
	const [draft, setDraft] = useState<ContractTemplateDraft | null>(null);
	const [deleteVariableId, setDeleteVariableId] = useState<string | null>(null);
	const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
	const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
		null,
	);
	const [autoActivateDocumentId, setAutoActivateDocumentId] = useState<
		string | null
	>(null);
	const [cutoverTarget, setCutoverTarget] = useState<boolean | null>(null);

	const createTemplateMutation = useCreateContractTemplate();
	const deleteTemplateMutation = useDeleteContractTemplate();
	const detailQuery = useContractTemplate(selectedId ?? undefined);
	const detail = detailQuery.data as
		| ContractTemplateDetailWithDocuments
		| undefined;
	const documents = detail?.documents ?? [];
	const previewDocumentReady = documents.some(
		(document) =>
			document.id === previewDocumentId && document.status === "ready",
	);
	const updateTemplateMutation = useUpdateContractTemplate(selectedId ?? "");
	const createVariableMutation = useCreateVariable(selectedId ?? "");
	const deleteVariableMutation = useDeleteVariable(selectedId ?? "");
	const createBlockMutation = useCreateBlock(selectedId ?? "");
	const deleteBlockMutation = useDeleteBlock(selectedId ?? "");
	const uploadDocumentMutation = useUploadContractTemplateDocument(
		selectedId ?? "",
	);
	const retryDocumentMutation = useRetryContractTemplateDocument(
		selectedId ?? "",
	);
	const activateDocumentMutation = useActivateContractTemplateDocument(
		selectedId ?? "",
	);
	const cutoverMutation = useEnableContractDocxCutover();
	const previewDocumentQuery = useContractTemplateDocumentPdf(
		selectedId ?? undefined,
		previewDocumentReady ? (previewDocumentId ?? undefined) : undefined,
	);
	const previewPdfUrl = useBlobObjectUrl(previewDocumentQuery.data);

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

	useEffect(() => {
		if (!autoActivateDocumentId || activateDocumentMutation.isPending) return;
		if (detail?.template.active_document_id === autoActivateDocumentId) {
			setAutoActivateDocumentId(null);
			showToast("DOCX version is ready and active", "success");
			return;
		}
		const uploadedDocument = documents.find(
			(document) => document.id === autoActivateDocumentId,
		);
		if (uploadedDocument?.status !== "ready") return;
		activateDocumentMutation.mutate(autoActivateDocumentId, {
			onSuccess: () => {
				setAutoActivateDocumentId(null);
				showToast("DOCX version is ready and active", "success");
			},
		});
	}, [
		activateDocumentMutation,
		autoActivateDocumentId,
		detail?.template.active_document_id,
		documents,
		showToast,
	]);

	const templates = templatesQuery.data ?? [];

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
		readiness: readinessQuery.data,
		readinessLoading: readinessQuery.isLoading,
		readinessError: readinessQuery.error,
		cutoverPending: cutoverMutation.isPending,
		cutoverError: cutoverMutation.error,
		cutoverEnabled: readinessQuery.data?.enabled ?? false,
		cutoverTarget,
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
			documents,
			activeDocumentId: detail?.template.active_document_id ?? null,
			previewDocumentId,
			previewPdfUrl,
			previewLoading:
				previewDocumentQuery.isLoading || previewDocumentQuery.isFetching,
			previewError: previewDocumentQuery.error,
			uploadPending: uploadDocumentMutation.isPending,
			uploadError: uploadDocumentMutation.error,
			retryingDocumentId: retryDocumentMutation.isPending
				? (retryDocumentMutation.variables ?? null)
				: null,
			retryError: retryDocumentMutation.error,
			activatingDocumentId: activateDocumentMutation.isPending
				? (activateDocumentMutation.variables ?? null)
				: null,
			activateError: activateDocumentMutation.error,
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
			uploadDocument: (file) =>
				uploadDocumentMutation.mutate(file, {
					onSuccess: (document) => {
						if (!detail?.template.active_document_id) {
							setAutoActivateDocumentId(document.id);
						}
						setPreviewDocumentId(document.id);
						showToast("DOCX uploaded. Conversion has started.", "success");
					},
				}),
			retryDocument: (documentId) =>
				retryDocumentMutation.mutate(documentId, {
					onSuccess: () => {
						if (!detail?.template.active_document_id) {
							setAutoActivateDocumentId(documentId);
						}
						showToast("Conversion retry queued", "success");
					},
				}),
			activateDocument: (documentId) =>
				activateDocumentMutation.mutate(documentId, {
					onSuccess: () => showToast("Template version activated", "success"),
				}),
			previewDocument: setPreviewDocumentId,
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
		requestCutover: setCutoverTarget,
		cancelCutover: () => setCutoverTarget(null),
		confirmCutover: () => {
			if (cutoverTarget === null) return;
			cutoverMutation.mutate(cutoverTarget, {
				onSuccess: () => {
					setCutoverTarget(null);
					showToast(
						cutoverTarget
							? "DOCX cutover enabled"
							: "DOCX cutover paused for future submissions",
						"success",
					);
				},
			});
		},
	};
}
