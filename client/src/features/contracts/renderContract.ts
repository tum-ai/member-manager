import type { ContractConditionalBlock } from "@member-manager/shared";
import {
	enrichContractFormData,
	renderContractText as renderSharedContractText,
} from "@member-manager/shared";

export function renderContractText(
	contractText: string,
	formData: Record<string, unknown>,
	blocks: ContractConditionalBlock[],
): string {
	const enrichedFormData = enrichContractFormData(formData);
	return renderSharedContractText(contractText, enrichedFormData, blocks);
}
