import type { Member, Sepa } from "../../types";

export interface AdminMember extends Member {
	sepa?: Partial<Sepa> | null;
}

export interface AdminFilters {
	search: string;
	mandateAgreed: string;
	privacyAgreed: string;
	active: string;
}

export type AdminSortKey =
	| "surname"
	| "department"
	| "member_role"
	| "phone"
	| "iban"
	| "bic"
	| "bank_name"
	| "mandate_agreed"
	| "privacy_agreed"
	| "active";

export const BOOLEAN_FILTER_OPTIONS = [
	{ label: "All", value: "" },
	{ label: "Accepted", value: "true" },
	{ label: "Not accepted", value: "false" },
] as const;

export const ACTIVE_FILTER_OPTIONS = [
	{ label: "All", value: "" },
	{ label: "Active", value: "true" },
	{ label: "Alumni", value: "false" },
] as const;

export function hasMandateAgreement(member: AdminMember): boolean {
	return member.sepa?.mandate_agreed ?? false;
}

export function hasPrivacyAgreement(member: AdminMember): boolean {
	return member.sepa?.privacy_agreed ?? false;
}

function normalizeBooleanFilterValue(
	value: boolean | null | undefined,
): string {
	return String(value ?? false);
}

export function filterAdminMembers(
	members: AdminMember[],
	filters: AdminFilters,
): AdminMember[] {
	const normalizedSearch = filters.search.trim().toLowerCase();

	return members.filter((member) => {
		const searchableText = [
			member.surname,
			member.given_name,
			member.email,
			member.phone,
			member.department,
			member.member_role,
			member.batch,
			member.degree,
			member.school,
			member.sepa?.iban,
			member.sepa?.bic,
			member.sepa?.bank_name,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();

		if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
			return false;
		}

		if (
			filters.mandateAgreed !== "" &&
			normalizeBooleanFilterValue(hasMandateAgreement(member)) !==
				filters.mandateAgreed
		) {
			return false;
		}

		if (
			filters.privacyAgreed !== "" &&
			normalizeBooleanFilterValue(hasPrivacyAgreement(member)) !==
				filters.privacyAgreed
		) {
			return false;
		}

		if (
			filters.active !== "" &&
			normalizeBooleanFilterValue(member.active) !== filters.active
		) {
			return false;
		}

		return true;
	});
}

export function getAdminSortValue(
	member: AdminMember,
	sortBy: AdminSortKey,
): string {
	switch (sortBy) {
		case "iban":
			return member.sepa?.iban ?? "";
		case "bic":
			return member.sepa?.bic ?? "";
		case "bank_name":
			return member.sepa?.bank_name ?? "";
		case "mandate_agreed":
			return hasMandateAgreement(member) ? "1" : "0";
		case "privacy_agreed":
			return hasPrivacyAgreement(member) ? "1" : "0";
		case "active":
			return member.active ? "1" : "0";
		case "surname":
			return `${member.surname} ${member.given_name}`.trim();
		default:
			return String(member[sortBy] ?? "");
	}
}

export function sortAdminMembers(
	members: AdminMember[],
	sortBy: AdminSortKey,
	sortAsc: boolean,
): AdminMember[] {
	return [...members].sort((left, right) => {
		const leftValue = getAdminSortValue(left, sortBy);
		const rightValue = getAdminSortValue(right, sortBy);
		const comparison = leftValue.localeCompare(rightValue);
		return sortAsc ? comparison : comparison * -1;
	});
}

export function getAdminMemberInitials(member: AdminMember): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
}
