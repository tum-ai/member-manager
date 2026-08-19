import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";

const MAGIC = Buffer.from("MMCA1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MINIMUM_KEY_LENGTH = 32;
const AAD = Buffer.from("member-manager:contract-artifact:v1", "utf8");
const JSON_PREFIX = "enc-bin-v1:";

function configuredSecrets(): string[] {
	const primary = process.env.FIELD_ENCRYPTION_KEY;
	if (!primary) throw new Error("Missing FIELD_ENCRYPTION_KEY");

	let fallbacks: unknown = [];
	const rawFallbacks = process.env.FIELD_ENCRYPTION_KEY_FALLBACKS;
	if (rawFallbacks) {
		try {
			fallbacks = JSON.parse(rawFallbacks);
		} catch {
			throw new Error("FIELD_ENCRYPTION_KEY_FALLBACKS must be a JSON array");
		}
	}
	if (
		!Array.isArray(fallbacks) ||
		fallbacks.some((value) => typeof value !== "string")
	) {
		throw new Error("FIELD_ENCRYPTION_KEY_FALLBACKS must be a JSON array");
	}

	const secrets = [
		primary,
		...fallbacks.filter(
			(value): value is string =>
				typeof value === "string" && value !== primary,
		),
	];
	if (secrets.some((secret) => secret.length < MINIMUM_KEY_LENGTH)) {
		throw new Error(
			"Contract artifact encryption keys must be at least 32 characters",
		);
	}
	return secrets;
}

function deriveKey(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}

export function isEncryptedContractArtifact(value: Buffer): boolean {
	return (
		value.length >= MAGIC.length &&
		value.subarray(0, MAGIC.length).equals(MAGIC)
	);
}

export function encryptContractArtifact(plaintext: Buffer): Buffer {
	const [primary] = configuredSecrets();
	if (!primary) throw new Error("Missing FIELD_ENCRYPTION_KEY");
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", deriveKey(primary), iv);
	cipher.setAAD(AAD);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptContractArtifact(encrypted: Buffer): Buffer {
	if (!isEncryptedContractArtifact(encrypted)) {
		throw new Error("Contract artifact is not encrypted");
	}
	const minimumLength = MAGIC.length + IV_BYTES + TAG_BYTES;
	if (encrypted.length < minimumLength) {
		throw new Error("Encrypted contract artifact is malformed");
	}

	const ivStart = MAGIC.length;
	const tagStart = ivStart + IV_BYTES;
	const ciphertextStart = tagStart + TAG_BYTES;
	const iv = encrypted.subarray(ivStart, tagStart);
	const tag = encrypted.subarray(tagStart, ciphertextStart);
	const ciphertext = encrypted.subarray(ciphertextStart);

	let lastError: Error | undefined;
	for (const secret of configuredSecrets()) {
		try {
			const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
			decipher.setAAD(AAD);
			decipher.setAuthTag(tag);
			return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
		}
	}
	throw new Error("Unable to decrypt contract artifact", { cause: lastError });
}

export function encryptContractJson(value: unknown): string {
	const json = JSON.stringify(value);
	if (json === undefined)
		throw new Error("Contract JSON value cannot be serialized");
	return `${JSON_PREFIX}${encryptContractArtifact(Buffer.from(json, "utf8")).toString("base64url")}`;
}

export function decryptContractJson<T = unknown>(value: string): T {
	if (!value.startsWith(JSON_PREFIX)) {
		throw new Error("Contract JSON payload is not encrypted");
	}
	const encoded = value.slice(JSON_PREFIX.length);
	if (!encoded) throw new Error("Encrypted contract JSON payload is malformed");
	const json = decryptContractArtifact(
		Buffer.from(encoded, "base64url"),
	).toString("utf8");
	return JSON.parse(json) as T;
}
