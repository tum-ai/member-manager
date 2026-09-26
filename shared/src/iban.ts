import { friendlyFormatIBAN, isValidIBAN } from "ibantools";
import { z } from "zod";

export const INVALID_IBAN_MESSAGE = "Invalid IBAN";

/** Longest IBAN any country issues (electronic form, no separators). */
export const IBAN_MAX_LENGTH = 34;

export function normalizeIban(value: string): string {
	return value
		.normalize("NFKC")
		.replace(/[\s-]+/gu, "")
		.toUpperCase();
}

/**
 * Reduces free-form IBAN text — typed, pasted from a banking app, or read off
 * a document — to its electronic form: `normalizeIban`, then drop every
 * remaining non-alphanumeric (colons, dots, slashes) and a leading "IBAN"
 * label such as "IBAN: DE89 …". Does not validate; pair with `isValidIban`.
 *
 * The label is only stripped when a country code and check digits follow, so
 * a partially typed value is never rewritten underneath the user.
 */
export function cleanIbanInput(value: string): string {
	return normalizeIban(value)
		.replace(/[^A-Z0-9]+/gu, "")
		.replace(/^IBAN(?=[A-Z]{2}\d{2})/u, "");
}

/**
 * Formats an IBAN for display in blocks of four ("DE89 3704 0044 …").
 * Accepts any spacing or case; does not validate. Returns "" for empty input.
 */
export function formatIban(value: string): string {
	return friendlyFormatIBAN(normalizeIban(value)) ?? "";
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
