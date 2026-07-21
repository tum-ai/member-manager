import { isValidIBAN } from "ibantools";
import { z } from "zod";

export const INVALID_IBAN_MESSAGE = "Invalid IBAN";

export function normalizeIban(value: string): string {
	return value
		.normalize("NFKC")
		.replace(/[\s-]+/gu, "")
		.toUpperCase();
}

export function isValidIban(value: string): boolean {
	return isValidIBAN(normalizeIban(value));
}

export const ibanSchema = z
	.string()
	.transform(normalizeIban)
	.refine(isValidIBAN, INVALID_IBAN_MESSAGE);
