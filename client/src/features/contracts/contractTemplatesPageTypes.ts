import type {
	ContractConditionalBlockInput,
	ContractTemplate,
	ContractTemplateDetail,
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
	setDraft: (draft: ContractTemplateDraft) => void;
	save: () => void;
	discard: () => void;
	createVariable: (values: NewContractTemplateVariable) => void;
	createBlock: (values: NewContractConditionalBlock) => void;
	setDeleteVariableId: (id: string | null) => void;
	setDeleteBlockId: (id: string | null) => void;
	deleteVariable: () => void;
	deleteBlock: () => void;
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
	editor: ContractTemplateEditorViewModel;
	setListOpen: (open: boolean) => void;
	setNewTemplateOpen: (open: boolean) => void;
	setDeleteTarget: (template: ContractTemplate | null) => void;
	selectTemplate: (id: string) => void;
	createTemplate: (name: string) => void;
	deleteTemplate: () => void;
}
