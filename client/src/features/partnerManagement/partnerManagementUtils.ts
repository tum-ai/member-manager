import type {
	ManagedPartner,
	PartnerJobStatus,
	PartnerJobType,
	PartnerStatus,
} from "@member-manager/shared";

export type PartnerStatusFilter = Exclude<PartnerStatus, "archived"> | "all";

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
	invited: "Awaiting activation",
	active: "Active",
	expired: "Expired",
	archived: "Archived",
};

export function partnerKindLabel(kind: ManagedPartner["partnerKind"]): string {
	return kind === "single_job_buyer"
		? "Single job posting"
		: "Long-term partner";
}

export function partnerTierLabel(partner: ManagedPartner): string {
	return partner.partnerKind === "single_job_buyer"
		? "No package tier"
		: (partner.tier?.displayName ?? "Unknown");
}

export const PARTNER_JOB_TYPE_LABELS: Record<PartnerJobType, string> = {
	internship: "Internship",
	working_student: "Working student",
	full_time: "Full-time",
	thesis: "Thesis",
	other: "Other",
};

export const PARTNER_JOB_STATUS_LABELS: Record<PartnerJobStatus, string> = {
	draft: "Draft",
	pending_review: "Awaiting review",
	approved: "Published",
	rejected: "Rejected",
	archived: "Archived",
};

export function formatContractRange(
	start: string,
	end: string,
	locale = "en-GB",
): string {
	const formatter = new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
	return `${formatter.format(new Date(`${start}T00:00:00`))} - ${formatter.format(
		new Date(`${end}T00:00:00`),
	)}`;
}

export function filterPartners(
	partners: ManagedPartner[],
	searchTerm: string,
	status: PartnerStatusFilter,
): ManagedPartner[] {
	const search = searchTerm.trim().toLowerCase();
	return partners.filter((partner) => {
		if (status !== "all" && partner.status !== status) return false;
		if (!search) return true;
		return [
			partner.companyName,
			partner.primaryEmail,
			partnerTierLabel(partner),
		]
			.join(" ")
			.toLowerCase()
			.includes(search);
	});
}
