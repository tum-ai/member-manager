import type { User } from "@supabase/supabase-js";

// Radix Select forbids empty-string item values, so an empty selection is
// represented by this sentinel and mapped back to "" at the boundary.
export const NONE_VALUE = "__none__";

export const toSelectValue = (value: string): string =>
	value === "" ? NONE_VALUE : value;

export const fromSelectValue = (value: string): string =>
	value === NONE_VALUE ? "" : value;

export function normalizeTextValue(value?: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function normalizeSerializedTextValue(
	value?: string | null,
): string | null {
	if (!value?.trim()) return null;
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function extractSlackProfile(user: User): {
	given_name: string;
	surname: string;
} {
	const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
	const getString = (key: string): string => {
		const value = metadata[key];
		return typeof value === "string" ? value.trim() : "";
	};

	let given = getString("given_name") || getString("first_name");
	let family = getString("family_name") || getString("last_name");

	if (!given || !family) {
		const fullName = getString("name") || getString("full_name");
		if (fullName) {
			const parts = fullName.split(/\s+/);
			if (!given) given = parts[0] ?? "";
			if (!family && parts.length > 1) family = parts.slice(1).join(" ");
		}
	}

	return { given_name: given, surname: family };
}
