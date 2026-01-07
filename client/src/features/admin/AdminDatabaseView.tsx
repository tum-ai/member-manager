import { useState } from "react";
import * as XLSX from "xlsx";
import { useToast } from "../../contexts/ToastContext";
import { useAdminData } from "../../hooks/useAdminData";
import type { Member } from "../../types";

interface Filters {
	search: string;
	mandateAgreed: string;
	privacyAgreed: string;
	active: string;
}

export default function AdminDatabaseView() {
	const { showToast } = useToast();
	const { members, isLoading, error, toggleStatus } = useAdminData();

	const [filters, setFilters] = useState<Filters>({
		search: "",
		mandateAgreed: "",
		privacyAgreed: "",
		active: "",
	});
	const [sortBy, setSortBy] = useState<string>("surname");
	const [sortAsc, setSortAsc] = useState(true);

	if (isLoading)
		return <div className="text-white text-center p-8">Loading data...</div>;
	if (error)
		return (
			<div className="text-red-500 text-center p-8">Error: {error.message}</div>
		);

	const filtered = (members || [])
		.filter((row) => {
			const { search, mandateAgreed, privacyAgreed, active } = filters;
			const text =
				`${row.surname} ${row.given_name} ${row.email} ${row.phone} ${row.sepa.iban || ""} ${row.sepa.bic || ""} ${row.sepa.bank_name || ""}`.toLowerCase();

			if (search && !text.includes(search.toLowerCase())) return false;
			if (
				mandateAgreed !== "" &&
				String(row.sepa?.mandate_agreed) !== mandateAgreed
			)
				return false;
			if (
				privacyAgreed !== "" &&
				String(row.sepa?.privacy_agreed) !== privacyAgreed
			)
				return false;
			if (active !== "" && String(row.active) !== active) return false;

			return true;
		})
		.sort((a, b) => {
			// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
			const valA = (a as any)[sortBy] ?? (a.sepa as any)?.[sortBy] ?? "";
			// biome-ignore lint/suspicious/noExplicitAny: Allow indexing
			const valB = (b as any)[sortBy] ?? (b.sepa as any)?.[sortBy] ?? "";
			return sortAsc
				? String(valA).localeCompare(String(valB))
				: String(valB).localeCompare(String(valA));
		});

	function getRowStyle(member: Member) {
		if (member.sepa?.mandate_agreed && !member.active) {
			return "bg-red-600 text-white"; // red: SEPA enabled but inactive
		}
		if (member.sepa?.mandate_agreed && member.active) {
			return "bg-green-600 text-white"; // green: SEPA enabled and active
		}
		return "bg-orange-500 text-white"; // orange: SEPA not enabled
	}

	async function handleToggleStatus(member: Member) {
		const newStatus = !member.active;
		const confirmation = window.confirm(
			`Are you sure you want to change the status of ${member.given_name} ${member.surname} to ${newStatus ? "active" : "inactive"}?`,
		);

		if (!confirmation) return;

		try {
			await toggleStatus({ userId: member.user_id, newStatus });
			showToast("Status updated successfully", "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update status: ${errorMessage}`, "error");
		}
	}

	function exportToExcel() {
		const exportData = filtered.map((member) => ({
			Surname: member.surname,
			"Given Name": member.given_name,
			Email: member.email,
			Phone: member.phone,
			IBAN: member.sepa?.iban || "",
			BIC: member.sepa?.bic || "",
			"Bank Name": member.sepa?.bank_name || "",
			"SEPA Mandate": String(member.sepa?.mandate_agreed),
			"Privacy Agreed": String(member.sepa?.privacy_agreed),
			Active: String(member.active),
		}));

		const worksheet = XLSX.utils.json_to_sheet(exportData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
		XLSX.writeFile(workbook, "members_export.xlsx");
	}

	function downloadEmails() {
		const emails = filtered
			.map((m) => m.email)
			.filter(Boolean)
			.join(", ");
		const blob = new Blob([emails], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "filtered_emails.txt";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	const boolOptions = [
		{ label: "All", value: "" },
		{ label: "Yes", value: "true" },
		{ label: "No", value: "false" },
	];

	return (
		<div className="min-h-screen p-8 text-white">
			<h2 className="text-3xl font-bold mb-6">Admin Database View</h2>

			{/* Filters */}
			<div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-800 rounded-lg">
				<input
					type="text"
					placeholder="Search text..."
					value={filters.search}
					onChange={(e) =>
						setFilters((f) => ({ ...f, search: e.target.value }))
					}
					className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 w-full md:w-64"
				/>

				<div className="flex items-center gap-2">
					<span>SEPA Mandate:</span>
					<select
						value={filters.mandateAgreed}
						onChange={(e) =>
							setFilters((f) => ({ ...f, mandateAgreed: e.target.value }))
						}
						className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
					>
						{boolOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2">
					<span>Privacy Agreed:</span>
					<select
						value={filters.privacyAgreed}
						onChange={(e) =>
							setFilters((f) => ({ ...f, privacyAgreed: e.target.value }))
						}
						className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
					>
						{boolOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2">
					<span>Active:</span>
					<select
						value={filters.active}
						onChange={(e) =>
							setFilters((f) => ({ ...f, active: e.target.value }))
						}
						className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
					>
						{boolOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-4 mb-6">
				<button
					type="button"
					onClick={exportToExcel}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
				>
					Export to Excel
				</button>
				<button
					type="button"
					onClick={downloadEmails}
					className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded font-medium transition-colors"
				>
					Download Filtered Emails
				</button>
			</div>

			{/* Table */}
			<div className="overflow-x-auto rounded-lg border border-gray-700">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="bg-gray-900 text-left">
							{[
								{ key: "surname", label: "Surname" },
								{ key: "given_name", label: "Given Name" },
								{ key: "email", label: "Email" },
								{ key: "phone", label: "Phone" },
								{ key: "iban", label: "IBAN" },
								{ key: "bic", label: "BIC" },
								{ key: "bank_name", label: "Bank Name" },
								{ key: "mandate_agreed", label: "SEPA" },
								{ key: "privacy_agreed", label: "Privacy" },
								{ key: "active", label: "Active" },
								{ key: "actions", label: "Actions" },
							].map(({ key, label }) => (
								<th
									key={key}
									onClick={() => {
										setSortBy(key);
										setSortAsc((prev) => (sortBy === key ? !prev : true));
									}}
									className="p-3 cursor-pointer hover:bg-gray-800 select-none whitespace-nowrap"
								>
									{label} {sortBy === key ? (sortAsc ? "▲" : "▼") : ""}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{filtered.map((row) => (
							<tr
								key={row.user_id}
								className={`${getRowStyle(row)} border-b border-gray-700`}
							>
								<td className="p-3">{row.surname}</td>
								<td className="p-3">{row.given_name}</td>
								<td className="p-3">{row.email}</td>
								<td className="p-3">{row.phone}</td>
								<td className="p-3">{row.sepa?.iban || ""}</td>
								<td className="p-3">{row.sepa?.bic || ""}</td>
								<td className="p-3">{row.sepa?.bank_name || ""}</td>
								<td className="p-3">{String(row.sepa?.mandate_agreed)}</td>
								<td className="p-3">{String(row.sepa?.privacy_agreed)}</td>
								<td className="p-3">{String(row.active)}</td>
								<td className="p-3">
									<button
										type="button"
										onClick={() => handleToggleStatus(row)}
										className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
											row.active
												? "bg-red-700 hover:bg-red-800"
												: "bg-green-700 hover:bg-green-800"
										}`}
									>
										{row.active ? "Set Inactive" : "Set Active"}
									</button>
								</td>
							</tr>
						))}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={11} className="p-8 text-center text-gray-400">
									No records found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
