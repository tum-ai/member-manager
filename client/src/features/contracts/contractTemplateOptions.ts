import type {
	ContractConditionType,
	ContractVariableDataType,
} from "@member-manager/shared";

export const CONTRACT_DATA_TYPE_LABELS: Record<
	ContractVariableDataType,
	string
> = {
	TEXT: "Text",
	EMAIL: "Email",
	TEXTAREA: "Long text",
	NUMBER: "Number",
	DATE: "Date",
	BOOLEAN: "Yes / No",
	SELECT: "Dropdown",
	FILE: "File",
};

export const CONTRACT_CONDITION_TYPE_LABELS: Record<
	ContractConditionType,
	string
> = {
	ALWAYS: "Always",
	IF_YES: "If yes",
	IF_NO: "If no",
	IF_VALUE: "If value equals",
};
