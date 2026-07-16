import type { ManagedPartner, PartnerStatus } from "@member-manager/shared";

export type PartnerStatusFilter = PartnerStatus | "all";

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
			partner.tier?.displayName ?? "",
		]
			.join(" ")
			.toLowerCase()
			.includes(search);
	});
}
