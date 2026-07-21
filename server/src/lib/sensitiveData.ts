import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const ENCRYPTION_PREFIX = "enc-v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MINIMUM_SECRET_LENGTH = 32;

export const SENSITIVE_MEMBER_FIELDS = [
	"date_of_birth",
	"street",
	"number",
	"postal_code",
	"city",
	"country",
	"phone",
] as const;

export const SENSITIVE_SEPA_FIELDS = ["iban", "bic", "bank_name"] as const;
export const SENSITIVE_REIMBURSEMENT_FIELDS = [
	"payment_iban",
	"payment_bic",
] as const;

type SensitiveField =
	| (typeof SENSITIVE_MEMBER_FIELDS)[number]
	| (typeof SENSITIVE_SEPA_FIELDS)[number]
	| (typeof SENSITIVE_REIMBURSEMENT_FIELDS)[number];

function allowInsecureTransport(hostname: string): boolean {
	return hostname === "127.0.0.1" || hostname === "localhost";
}

export function assertSecureRemoteUrl(rawUrl: string, envName: string): void {
	const parsedUrl = new URL(rawUrl);

	if (
		process.env.NODE_ENV === "production" &&
		parsedUrl.protocol !== "https:" &&
		!allowInsecureTransport(parsedUrl.hostname)
	) {
		throw new Error(`${envName} must use HTTPS in production`);
	}
}

function assertValidEncryptionSecret(secret: string, envName: string): void {
	if (secret.length < MINIMUM_SECRET_LENGTH) {
		throw new Error(`${envName} must be at least 32 characters`);
	}
}

function deriveEncryptionKey(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}

function getEncryptionKeys(): Buffer[] {
	const secret = process.env.FIELD_ENCRYPTION_KEY;

	if (!secret) {
		throw new Error("Missing FIELD_ENCRYPTION_KEY");
	}
	assertValidEncryptionSecret(secret, "FIELD_ENCRYPTION_KEY");

	const rawFallbacks = process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
	let fallbacks: unknown = [];
	if (rawFallbacks) {
		try {
			fallbacks = JSON.parse(rawFallbacks);
		} catch {
			throw new Error("FIELD_ENCRYPTION_KEY_FALLBACKS must be a JSON array");
		}
	}
	if (
		!Array.isArray(fallbacks) ||
		fallbacks.some((fallback) => typeof fallback !== "string")
	) {
		throw new Error("FIELD_ENCRYPTION_KEY_FALLBACKS must be a JSON array");
	}

	const uniqueSecrets = [
		secret,
		...fallbacks.filter((fallback) => fallback !== secret),
	];
	for (const [index, encryptionSecret] of uniqueSecrets.entries()) {
		assertValidEncryptionSecret(
			encryptionSecret,
			index === 0
				? "FIELD_ENCRYPTION_KEY"
				: "FIELD_ENCRYPTION_KEY_FALLBACKS entries",
		);
	}

	return uniqueSecrets.map(deriveEncryptionKey);
}

export function assertFieldEncryptionConfigured(): void {
	getEncryptionKeys();
}

export function isEncryptedValue(value: unknown): value is string {
	return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export function encryptValue(value: unknown): unknown {
	if (value === null || value === undefined || value === "") {
		return value;
	}

	if (typeof value !== "string") {
		return value;
	}

	if (isEncryptedValue(value)) {
		return value;
	}

	const [key] = getEncryptionKeys();
	if (!key) {
		throw new Error("Missing FIELD_ENCRYPTION_KEY");
	}
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(value, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return [
		ENCRYPTION_PREFIX,
		iv.toString("base64url"),
		authTag.toString("base64url"),
		encrypted.toString("base64url"),
	].join(":");
}

function decryptEncryptedValue(value: string, keys: Buffer[]): string {
	const [, ivBase64, authTagBase64, encryptedBase64] = value.split(":");

	if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
		throw new Error("Encrypted value is malformed");
	}

	const iv = Buffer.from(ivBase64, "base64url");
	const authTag = Buffer.from(authTagBase64, "base64url");
	const encrypted = Buffer.from(encryptedBase64, "base64url");

	if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
		throw new Error("Encrypted value has invalid metadata");
	}

	let lastError: Error | undefined;
	for (const key of keys) {
		try {
			const decipher = createDecipheriv("aes-256-gcm", key, iv);
			decipher.setAuthTag(authTag);
			return Buffer.concat([
				decipher.update(encrypted),
				decipher.final(),
			]).toString("utf8");
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
		}
	}

	throw new Error("Unable to decrypt encrypted value", { cause: lastError });
}

export function decryptValue(value: unknown): unknown {
	if (value === null || value === undefined || value === "") {
		return value;
	}

	if (typeof value !== "string" || !isEncryptedValue(value)) {
		return value;
	}

	return decryptEncryptedValue(value, getEncryptionKeys());
}

export function decryptValueWithPrimaryKey(value: unknown): string {
	if (!isEncryptedValue(value)) {
		throw new Error("Expected an encrypted value");
	}
	const [primaryKey] = getEncryptionKeys();
	if (!primaryKey) {
		throw new Error("Missing FIELD_ENCRYPTION_KEY");
	}
	return decryptEncryptedValue(value, [primaryKey]);
}

export function encryptRecord<T extends Record<string, unknown>>(
	record: T,
	fields: readonly SensitiveField[],
): T {
	const clone = { ...record } as Record<string, unknown>;

	for (const field of fields) {
		if (field in clone) {
			clone[field] = encryptValue(clone[field]);
		}
	}

	return clone as T;
}

export function decryptRecord<T extends Record<string, unknown>>(
	record: T,
	fields: readonly SensitiveField[],
): T {
	const clone = { ...record } as Record<string, unknown>;

	for (const field of fields) {
		if (field in clone) {
			clone[field] = decryptValue(clone[field]);
		}
	}

	return clone as T;
}

export function reencryptValue(value: unknown): unknown {
	return encryptValue(isEncryptedValue(value) ? decryptValue(value) : value);
}

export function reencryptRecord<T extends Record<string, unknown>>(
	record: T,
	fields: readonly SensitiveField[],
): T {
	const clone = { ...record } as Record<string, unknown>;

	for (const field of fields) {
		if (field in clone) {
			clone[field] = reencryptValue(clone[field]);
		}
	}

	return clone as T;
}

export function decryptRecordSafely<T extends Record<string, unknown>>(
	record: T,
	fields: readonly SensitiveField[],
	onError?: (context: {
		field: SensitiveField;
		value: unknown;
		error: Error;
	}) => void,
): T {
	const clone = { ...record } as Record<string, unknown>;

	for (const field of fields) {
		if (!(field in clone)) continue;

		try {
			clone[field] = decryptValue(clone[field]);
		} catch (error) {
			const normalizedError =
				error instanceof Error ? error : new Error(String(error));
			onError?.({
				field,
				value: clone[field],
				error: normalizedError,
			});
			clone[field] = "";
		}
	}

	return clone as T;
}
