import type { ContractRenderableBlock } from "./contracts.js";

export const CONTRACT_LANGUAGES = ["de", "en"] as const;

export type ContractLanguage = (typeof CONTRACT_LANGUAGES)[number];

export const DEFAULT_CONTRACT_LANGUAGE: ContractLanguage = "de";

/**
 * Reserved form-data key holding the language a contract is generated in. It is
 * not a template variable: the form writes it, and the renderer uses it to pick
 * between the German and English body text of the same template.
 */
export const CONTRACT_LANGUAGE_FIELD = "contract_language";

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;
const CONDITIONAL_REGEX =
	/\[(?:WENN|IF)\s+\{\{([a-zA-Z0-9_]+)\}\}\s*(=|!=|enthält|contains)\s*"([^"]*)"\s+(?:DANN|THEN)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\}(?:\s+(?:SONST|ELSE)\s+\{((?:[^{}]|\{\{[^}]*\}\})*)\})?\]/gi;
const RESERVED_SIGNATURE_TOKENS = new Set([
	"partner_signature",
	"board_signature",
]);

export interface ContractRenderOptions {
	formatDates?: boolean;
}

export function stringifyContractVariable(
	value: unknown,
	options: ContractRenderOptions = {},
): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (Array.isArray(value)) {
		return value
			.map((item) => stringifyContractVariable(item, options))
			.join(", ");
	}
	if (options.formatDates && value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

export function evaluateContractCondition(
	rawValue: unknown,
	operator: string,
	expected: string,
	options: ContractRenderOptions = {},
): boolean {
	const actual = stringifyContractVariable(rawValue, options).trim();
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
	options: ContractRenderOptions,
): string {
	return text.replace(
		CONDITIONAL_REGEX,
		(_full, variable, operator, expected, thenText, elseText) => {
			const matched = evaluateContractCondition(
				formData[variable],
				operator,
				expected,
				options,
			);
			return matched ? thenText : (elseText ?? "");
		},
	);
}

function substituteVariables(
	text: string,
	formData: Record<string, unknown>,
	options: ContractRenderOptions,
): string {
	return text.replace(VARIABLE_REGEX, (full, name) =>
		RESERVED_SIGNATURE_TOKENS.has(name)
			? full
			: stringifyContractVariable(formData[name], options),
	);
}

export function contractBlockMatches(
	block: ContractRenderableBlock,
	formData: Record<string, unknown>,
	options: ContractRenderOptions = {},
): boolean {
	if (block.condition_type === "ALWAYS") return true;
	const variable = block.condition_variable;
	if (!variable) return false;
	const raw = formData[variable];
	const asString = stringifyContractVariable(raw, options).trim();
	const normalized = asString.toLowerCase();
	switch (block.condition_type) {
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

/** The language the form asked for; German unless the form says otherwise. */
export function contractLanguageOf(
	formData: Record<string, unknown>,
): ContractLanguage {
	return formData[CONTRACT_LANGUAGE_FIELD] === "en"
		? "en"
		: DEFAULT_CONTRACT_LANGUAGE;
}

/**
 * Pick the template body for the language stored in the form data. Falls back
 * to the German text whenever the English translation is still missing, so a
 * template without a translation can never render as an empty contract.
 */
export function selectContractText(
	template: { contract_text: string; contract_text_en?: string | null },
	formData: Record<string, unknown>,
): string {
	if (contractLanguageOf(formData) === "en") {
		const english = template.contract_text_en;
		if (typeof english === "string" && english.trim()) return english;
	}
	return template.contract_text;
}

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractRenderableBlock[],
	options: ContractRenderOptions = {},
): string {
	const matchingBlocks = blocks
		.filter((block) => contractBlockMatches(block, formData, options))
		.sort((left, right) => left.sort_order - right.sort_order)
		.map((block) => block.block_text)
		.filter((text) => text.trim().length > 0);

	const combined =
		matchingBlocks.length > 0
			? `${contractText}\n\n${matchingBlocks.join("\n\n")}`
			: contractText;

	return substituteVariables(
		applyInlineConditionals(combined, formData, options),
		formData,
		options,
	);
}
