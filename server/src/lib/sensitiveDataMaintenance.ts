import {
	decryptValue,
	decryptValueWithPrimaryKey,
	isEncryptedValue,
} from "./sensitiveData.js";

export function verifySensitiveValue(
	value: unknown,
	{ primaryOnly }: { primaryOnly: boolean },
): void {
	if (value === null || value === undefined || value === "") return;
	if (!isEncryptedValue(value)) {
		throw new Error("Verification found a plaintext sensitive value");
	}
	if (primaryOnly) {
		decryptValueWithPrimaryKey(value);
	} else {
		decryptValue(value);
	}
}
