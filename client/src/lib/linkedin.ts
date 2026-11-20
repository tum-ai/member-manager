import { LINKEDIN_PROFILE_URL_REGEX } from "@member-manager/shared";

export { LINKEDIN_PROFILE_URL_REGEX };

export function isLinkedinProfileUrl(value?: string | null): value is string {
	return Boolean(value && LINKEDIN_PROFILE_URL_REGEX.test(value.trim()));
}

export function normalizeLinkedinProfileUrl(value?: string | null): string {
	return isLinkedinProfileUrl(value) ? value.trim() : "";
}
