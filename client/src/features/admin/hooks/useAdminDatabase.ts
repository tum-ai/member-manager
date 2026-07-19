import { useMemo, useState } from "react";
import writeXlsxFile from "write-excel-file/browser";
import { useToast } from "@/contexts/ToastContext";
import { initialFilters } from "@/features/admin/adminDatabaseViewTypes";
import {
	buildExportRows,
	buildXlsxData,
	rowsToCsv,
} from "@/features/admin/adminExportUtils";
import {
	type AdminFilters,
	type AdminMember,
	type AdminSortKey,
	filterAdminMembers,
	hasMandateAgreement,
	hasPrivacyAgreement,
	sortAdminMembers,
} from "@/features/admin/adminUtils";
import { useAdminData } from "@/hooks/useAdminData";

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function useAdminDatabase() {
	const {
		members,
		totalMembers,
		isLoading,
		isLoadingMoreMembers,
		isRefreshingMembers,
		error,
		updateMemberAsync,
		duplicateCandidates,
		duplicateCandidatesError,
		mergeMembersAsync,
		isMergingMembers,
		isSavingMember,
	} = useAdminData();
	const { showToast } = useToast();

	const [filters, setFilters] = useState<AdminFilters>(initialFilters);
	const [sortBy, setSortBy] = useState<AdminSortKey>("surname");
	const [sortAsc, setSortAsc] = useState(true);

	const allMembers = members ?? [];
	const loadedMemberCount = allMembers.length;
	const totalMemberCount = totalMembers ?? loadedMemberCount;

	const filtered = useMemo(
		() =>
			sortAdminMembers(
				filterAdminMembers(allMembers, filters),
				sortBy,
				sortAsc,
			),
		[allMembers, filters, sortAsc, sortBy],
	);

	const stats = useMemo(
		() => ({
			total: totalMemberCount,
			active: allMembers.filter((member) => member.active).length,
			sepaAccepted: allMembers.filter((member) => hasMandateAgreement(member))
				.length,
			privacyAccepted: allMembers.filter((member) =>
				hasPrivacyAgreement(member),
			).length,
		}),
		[allMembers, totalMemberCount],
	);

	function handleSortChange(column: AdminSortKey) {
		setSortBy(column);
		setSortAsc((previousValue) => (sortBy === column ? !previousValue : true));
	}

	async function exportToExcel() {
		const data = buildXlsxData(buildExportRows(filtered));
		try {
			await writeXlsxFile(data).toFile("members_export.xlsx");
		} catch {
			showToast("Could not generate the Excel export.", "error");
		}
	}

	function exportToCsv() {
		const exportData = buildExportRows(filtered);
		const csv = rowsToCsv(exportData);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		triggerDownload(blob, "members_export.csv");
	}

	function downloadEmails() {
		const emails = filtered
			.map((m) => m.email)
			.filter(Boolean)
			.join(", ");
		const blob = new Blob([emails], { type: "text/plain;charset=utf-8" });
		triggerDownload(blob, "filtered_emails.txt");
	}

	const memberLoadingMessage = isLoadingMoreMembers
		? `Loaded ${loadedMemberCount} of ${totalMemberCount} members. Loading the rest in the background...`
		: isRefreshingMembers
			? `Refreshing ${filtered.length} matching member${filtered.length === 1 ? "" : "s"}...`
			: `${filtered.length} member${filtered.length === 1 ? "" : "s"} match the current filters.`;

	return {
		isLoading,
		error,
		filters,
		setFilters,
		sortBy,
		sortAsc,
		handleSortChange,
		filtered,
		stats,
		exportToCsv,
		exportToExcel,
		downloadEmails,
		memberLoadingMessage,
		updateMemberAsync,
		duplicateCandidates,
		duplicateCandidatesError,
		mergeMembersAsync,
		isMergingMembers,
		isSavingMember,
	};
}

export type UseAdminDatabaseResult = ReturnType<typeof useAdminDatabase>;
export type AdminMemberRow = AdminMember;
