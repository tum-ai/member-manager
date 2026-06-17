import {
	getMemberStatusLabel,
	resolveDepartmentForMemberRole,
} from "@/lib/memberMetadata";
import { cn } from "@/lib/utils";
import type { MemberChangeRequest } from "./adminTypes";
import type { AdminMember } from "./adminUtils";

export const adminJobTypeLabels: Record<string, string> = {
	internship: "Internship",
	working_student: "Working student",
	full_time: "Full-time",
	thesis: "Thesis",
	other: "Other",
};

export function getSafeHttpUrl(value?: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? value : null;
	} catch {
		return null;
	}
}

export function formatAdminValue(value: unknown): string {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed || "Not set";
	}

	return value === null || value === undefined ? "Not set" : String(value);
}

export function formatCertificateLeadership(
	engagement: Record<string, unknown>,
): string {
	const roles: string[] = [];

	if (engagement.isTeamLead === true) {
		roles.push("Team Lead");
	}

	if (typeof engagement.specialRole === "string") {
		const specialRole = engagement.specialRole.trim();
		if (specialRole) {
			roles.push(specialRole);
		}
	}

	return roles.length > 0 ? roles.join(", ") : "Member";
}

export function getMemberDisplayName(
	members: AdminMember[],
	userId: string,
): string {
	const member = members.find((entry) => entry.user_id === userId);
	if (!member) {
		return "Unknown member";
	}

	return `${member.given_name} ${member.surname}`.trim() || "Unknown member";
}

export function formatRequestedChanges(
	members: AdminMember[],
	request: MemberChangeRequest,
): string {
	const member = members.find((entry) => entry.user_id === request.user_id);
	const currentRole =
		typeof member?.member_role === "string" && member.member_role.trim()
			? member.member_role
			: "Member";
	const currentDepartment = resolveDepartmentForMemberRole(
		currentRole,
		typeof member?.department === "string" || member?.department === null
			? member.department
			: null,
	);
	const requestedRole =
		typeof request.changes.member_role === "string"
			? request.changes.member_role
			: undefined;
	const requestedDepartmentValue =
		typeof request.changes.department === "string" ||
		request.changes.department === null
			? request.changes.department
			: currentDepartment;
	const effectiveDepartment =
		Object.hasOwn(request.changes, "department") || requestedRole
			? resolveDepartmentForMemberRole(
					requestedRole ?? currentRole,
					requestedDepartmentValue,
				)
			: undefined;
	const entries: string[] = [];

	if (
		effectiveDepartment !== undefined &&
		effectiveDepartment !== currentDepartment
	) {
		entries.push(
			`Department: ${formatAdminValue(currentDepartment)} -> ${formatAdminValue(
				effectiveDepartment,
			)}`,
		);
	}
	if (
		typeof request.changes.member_role === "string" &&
		request.changes.member_role !== currentRole
	) {
		entries.push(`Role: ${currentRole} -> ${request.changes.member_role}`);
	}
	if (
		typeof request.changes.member_status === "string" &&
		request.changes.member_status !==
			(member?.member_status || (member?.active ? "active" : "inactive"))
	) {
		entries.push(
			`Status: ${getMemberStatusLabel(
				member?.member_status || (member?.active ? "active" : "inactive"),
			)} -> ${getMemberStatusLabel(request.changes.member_status)}`,
		);
	}
	if (
		typeof request.changes.degree === "string" &&
		request.changes.degree !== (member?.degree ?? null)
	) {
		entries.push(
			`Degree: ${formatAdminValue(member?.degree)} -> ${request.changes.degree}`,
		);
	}
	if (
		typeof request.changes.school === "string" &&
		request.changes.school !== (member?.school ?? null)
	) {
		entries.push(
			`School: ${formatAdminValue(member?.school)} -> ${request.changes.school}`,
		);
	}
	if (
		typeof request.changes.batch === "string" &&
		request.changes.batch !== (member?.batch ?? null)
	) {
		entries.push(
			`Batch: ${formatAdminValue(member?.batch)} -> ${request.changes.batch}`,
		);
	}

	return entries.length > 0 ? entries.join(", ") : "No requested changes";
}

interface CertificateDetailRowProps {
	label: string;
	value: unknown;
	preserveWhitespace?: boolean;
}

export function CertificateDetailRow({
	label,
	value,
	preserveWhitespace = false,
}: CertificateDetailRowProps) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<p
				className={cn(
					preserveWhitespace ? "whitespace-pre-wrap" : "whitespace-normal",
				)}
			>
				{formatAdminValue(value)}
			</p>
		</div>
	);
}
