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

const IBAN_MASK = "••••";
/** Shorter values cannot keep a prefix and suffix without revealing most of it. */
const MIN_PARTIALLY_MASKED_IBAN_LENGTH = 12;

/**
 * Masks an IBAN for display, keeping only the country code, check digits, and
 * last four characters (`DE89 •••• •••• 3000`). Blank input yields an empty
 * string; values too short to be real IBANs are masked entirely so the output
 * never reveals most of the value.
 */
export function maskIban(value: string): string {
	const normalized = normalizeIban(value);
	if (!normalized) {
		return "";
	}
	if (normalized.length < MIN_PARTIALLY_MASKED_IBAN_LENGTH) {
		return IBAN_MASK;
	}

	return `${normalized.slice(0, 4)} ${IBAN_MASK} ${IBAN_MASK} ${normalized.slice(-4)}`;
}
