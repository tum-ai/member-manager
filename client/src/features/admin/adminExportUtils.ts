import type { SheetData } from "write-excel-file/browser";
import {
	getMemberStatusLabel,
	getOperationalDepartment,
} from "@/lib/memberMetadata";
import {
	type AdminMember,
	hasDataPrivacyNoticeAgreement,
	hasMandateAgreement,
	hasPrivacyAgreement,
} from "./adminUtils";

export function buildExportRows(
	rows: AdminMember[],
): Array<Record<string, string>> {
	return rows.map((member) => ({
		Surname: member.surname,
		"Given Name": member.given_name,
		Email: member.email,
		Phone: member.phone,
		Department: getOperationalDepartment(member.department) || "",
		Role: member.member_role || "",
		Board: member.board_role || "",
		"LinkedIn URL": member.linkedin_profile_url || "",
		"Public Location": member.public_location || "",
		IBAN: member.sepa?.iban || "",
		BIC: member.sepa?.bic || "",
		"Bank Name": member.sepa?.bank_name || "",
		"SEPA Mandate": hasMandateAgreement(member) ? "Accepted" : "Not accepted",
		"Privacy Agreed": hasPrivacyAgreement(member) ? "Accepted" : "Not accepted",
		"Data Privacy Notice": hasDataPrivacyNoticeAgreement(member)
			? "Accepted"
			: "Not accepted",
		Status: getMemberStatusLabel(
			member.member_status || (member.active ? "active" : "inactive"),
		),
	}));
}

// Shape the flat export rows into `write-excel-file` sheet data: a bold header
// row derived from the object keys, followed by one string cell per column.
// Empty cells become `null` so they render blank rather than as "".
export function buildXlsxData(rows: Array<Record<string, string>>): SheetData {
	if (rows.length === 0) {
		return [[null]];
	}
	const columns = Object.keys(rows[0]);
	const header = columns.map((column) => ({
		value: column,
		fontWeight: "bold" as const,
		type: String,
	}));
	const body = rows.map((row) =>
		columns.map((column) => {
			const value = row[column] ?? "";
			return value ? { value, type: String } : null;
		}),
	);
	return [header, ...body];
}

export function rowsToCsv(rows: Array<Record<string, string>>): string {
	if (rows.length === 0) {
		return "";
	}

	const columns = Object.keys(rows[0]);
	const lineEnding = "\r\n";
	const header = columns.map(escapeCsvCell).join(",");
	const body = rows
		.map((row) =>
			columns.map((column) => escapeCsvCell(row[column] ?? "")).join(","),
		)
		.join(lineEnding);

	return `${header}${lineEnding}${body}${lineEnding}`;
}

export function escapeCsvCell(value: string): string {
	const normalized = String(value);
	if (
		normalized.includes(",") ||
		normalized.includes('"') ||
		normalized.includes("\n") ||
		normalized.includes("\r")
	) {
		return `"${normalized.replaceAll('"', '""')}"`;
	}
	return normalized;
}
