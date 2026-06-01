// Mirrors server/src/routes/contracts.ts:renderContractText so the form
// preview matches what the server will store. Keep in sync if either side
// changes the template DSL.
import { enrichContractFormData } from "@member-manager/shared";
import type {
	ContractConditionalBlock,
	ContractConditionType,
} from "./useContracts";

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const CONDITIONAL_REGEX =
	/\[(?:WENN|IF)\s+\{\{([a-zA-Z0-9_]+)\}\}\s*(=|!=|enthält|contains)\s*"([^"]*)"\s+(?:DANN|THEN)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\}(?:\s+(?:SONST|ELSE)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\})?\]/gi;

function stringifyVariable(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) return value.map(stringifyVariable).join(", ");
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function evaluateCondition(
	rawValue: unknown,
	operator: string,
	expected: string,
): boolean {
	const actual = stringifyVariable(rawValue).trim();
	const target = expected.trim();
	switch (operator.toLowerCase()) {
		case "=":
			return actual === target;
		case "!=":
			return actual !== target;
		case "enthält":
		case "contains":
			return actual.toLowerCase().includes(target.toLowerCase());
		default:
			return false;
	}
}

function applyInlineConditionals(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(
		CONDITIONAL_REGEX,
		(_full, variable, op, expected, thenText, elseText) => {
			const matched = evaluateCondition(formData[variable], op, expected);
			return matched ? thenText : (elseText ?? "");
		},
	);
}

function substituteVariables(
	text: string,
	formData: Record<string, unknown>,
): string {
	return text.replace(VARIABLE_REGEX, (_full, name) =>
		stringifyVariable(formData[name]),
	);
}

function blockMatches(
	block: Pick<
		ContractConditionalBlock,
		"condition_type" | "condition_variable" | "condition_value"
	>,
	formData: Record<string, unknown>,
): boolean {
	if (block.condition_type === "ALWAYS") return true;
	const variable = block.condition_variable;
	if (!variable) return false;
	const raw = formData[variable];
	const asString = stringifyVariable(raw).trim();
	const normalized = asString.toLowerCase();
	const type: ContractConditionType = block.condition_type;
	switch (type) {
		case "IF_YES":
			return (
				raw === true ||
				normalized === "yes" ||
				normalized === "ja" ||
				normalized === "true"
			);
		case "IF_NO":
			return (
				raw === false ||
				normalized === "no" ||
				normalized === "nein" ||
				normalized === "false" ||
				asString === ""
			);
		case "IF_VALUE":
			return asString === (block.condition_value ?? "").trim();
		default:
			return false;
	}
}

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractConditionalBlock[],
): string {
	const enrichedFormData = enrichContractFormData(formData);
	const matching = blocks
		.filter((block) => blockMatches(block, enrichedFormData))
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((block) => block.block_text)
		.filter((text) => text.trim().length > 0);
	const combined =
		matching.length > 0
			? `${contractText}\n\n${matching.join("\n\n")}`
			: contractText;
	return substituteVariables(
		applyInlineConditionals(combined, enrichedFormData),
		enrichedFormData,
	);
}
