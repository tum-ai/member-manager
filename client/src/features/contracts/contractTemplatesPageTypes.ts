import type {
	ContractConditionalBlockInput,
	ContractDocxReadiness,
	ContractTemplate,
	ContractTemplateDetail,
	ContractTemplateDocument,
	ContractTemplateVariableInput,
} from "@member-manager/shared";

export interface ContractTemplateDraft {
	name: string;
	description: string;
	contract_text: string;
	is_active: boolean;
}

export type NewContractTemplateVariable = ContractTemplateVariableInput;

export type NewContractConditionalBlock = ContractConditionalBlockInput;

export interface ContractTemplateEditorViewModel {
	detail: ContractTemplateDetail | undefined;
	loading: boolean;
	error: Error | null;
	draft: ContractTemplateDraft | null;
	dirty: boolean;
	updatePending: boolean;
	updateError: Error | null;
	deleteVariableId: string | null;
	deleteBlockId: string | null;
	createVariablePending: boolean;
	createVariableError: Error | null;
	createBlockPending: boolean;
	createBlockError: Error | null;
	documents: ContractTemplateDocument[];
	activeDocumentId: string | null;
	previewDocumentId: string | null;
	previewPdfUrl: string | null;
	previewLoading: boolean;
	previewError: Error | null;
	uploadPending: boolean;
	uploadError: Error | null;
	retryingDocumentId: string | null;
	retryError: Error | null;
	activatingDocumentId: string | null;
	activateError: Error | null;
	setDraft: (draft: ContractTemplateDraft) => void;
	save: () => void;
	discard: () => void;
	createVariable: (values: NewContractTemplateVariable) => void;
	createBlock: (values: NewContractConditionalBlock) => void;
	setDeleteVariableId: (id: string | null) => void;
	setDeleteBlockId: (id: string | null) => void;
	deleteVariable: () => void;
	deleteBlock: () => void;
	uploadDocument: (file: File) => void;
	retryDocument: (documentId: string) => void;
	activateDocument: (documentId: string) => void;
	previewDocument: (documentId: string | null) => void;
}

export interface ContractTemplatesPageViewModel {
	templates: ContractTemplate[];
	templatesLoading: boolean;
	templatesError: Error | null;
	selectedId: string | null;
	selectedTemplate: ContractTemplate | undefined;
	listOpen: boolean;
	newTemplateOpen: boolean;
	deleteTarget: ContractTemplate | null;
	createTemplatePending: boolean;
	createTemplateError: Error | null;
	deleteTemplateError: Error | null;
	readiness: ContractDocxReadiness | undefined;
	readinessLoading: boolean;
	readinessError: Error | null;
	cutoverPending: boolean;
	cutoverError: Error | null;
	cutoverEnabled: boolean;
	cutoverTarget: boolean | null;
	editor: ContractTemplateEditorViewModel;
	setListOpen: (open: boolean) => void;
	setNewTemplateOpen: (open: boolean) => void;
	setDeleteTarget: (template: ContractTemplate | null) => void;
	selectTemplate: (id: string) => void;
	createTemplate: (name: string) => void;
	deleteTemplate: () => void;
	requestCutover: (enabled: boolean) => void;
	cancelCutover: () => void;
	confirmCutover: () => void;
}
