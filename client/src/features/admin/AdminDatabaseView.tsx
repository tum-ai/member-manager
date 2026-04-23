import { useEffect, useId, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useToast } from "../../contexts/ToastContext";
import { useAdminData } from "../../hooks/useAdminData";
import {
	type NewRoleHistoryEntry,
	useMemberRoleHistory,
} from "../../hooks/useMemberRoleHistory";
import {
	DEPARTMENTS,
	MEMBER_ROLES,
	type MemberRole,
} from "../../lib/constants";
import type { Member } from "../../types";

interface Filters {
	search: string;
	mandateAgreed: string;
	privacyAgreed: string;
	activeOnly: boolean;
	department: string;
	role: string;
}

// CSV serialization: RFC-4180. Any field containing a comma, quote, CR, or LF
// is wrapped in double-quotes, and embedded double-quotes are doubled.
function escapeCsvCell(value: unknown): string {
	const str = value === null || value === undefined ? "" : String(value);
	if (/[",\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function rowsToCsv(
	rows: Array<Record<string, unknown>>,
	columns: string[],
): string {
	const header = columns.map(escapeCsvCell).join(",");
	const body = rows
		.map((row) => columns.map((col) => escapeCsvCell(row[col])).join(","))
		.join("\n");
	return `${header}\n${body}\n`;
}

function RoleHistoryPanel({
	member,
	onClose,
}: {
	member: Member;
	onClose: () => void;
}) {
	const { entries, isLoading, addEntry, deleteEntry } = useMemberRoleHistory(
		member.user_id,
	);
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	const descriptionId = useId();
	const [draft, setDraft] = useState<NewRoleHistoryEntry>({
		role: "Member",
		semester: "",
		started_at: "",
		ended_at: "",
		note: "",
	});

	useEffect(() => {
		dialogRef.current?.focus();
	}, []);

	async function handleAdd() {
		const payload: NewRoleHistoryEntry = {
			role: draft.role,
			semester: draft.semester?.trim() || null,
			started_at: draft.started_at?.trim() || null,
			ended_at: draft.ended_at?.trim() || null,
			note: draft.note?.trim() || null,
		};
		try {
			await addEntry(payload);
			setDraft({
				role: "Member",
				semester: "",
				started_at: "",
				ended_at: "",
				note: "",
			});
		} catch (err) {
			console.error(err);
		}
	}

	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center p-4">
			<button
				type="button"
				aria-label="Close role history dialog"
				className="absolute inset-0 bg-black/60"
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				className="relative z-50 w-full max-w-3xl rounded-lg border border-gray-700 bg-gray-900 p-6 text-white shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						onClose();
					}
				}}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				tabIndex={-1}
			>
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<h3 id={titleId} className="text-xl font-semibold">
							Role history
						</h3>
						<p id={descriptionId} className="text-sm text-gray-400">
							{member.given_name} {member.surname} · current role:{" "}
							<strong>{member.member_role || "Member"}</strong>
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded px-2 py-1 text-sm hover:bg-gray-800"
					>
						Close
					</button>
				</div>

				<div className="mb-4 rounded border border-gray-700 p-3">
					<h4 className="mb-2 text-sm font-medium text-gray-300">
						Add past role
					</h4>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-5">
						<select
							value={draft.role}
							onChange={(e) =>
								setDraft((d) => ({ ...d, role: e.target.value as MemberRole }))
							}
							className="rounded bg-gray-800 p-2 text-sm"
						>
							{MEMBER_ROLES.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
						<input
							type="text"
							placeholder="Semester (e.g. WS25/26)"
							value={draft.semester ?? ""}
							onChange={(e) =>
								setDraft((d) => ({ ...d, semester: e.target.value }))
							}
							className="rounded bg-gray-800 p-2 text-sm"
						/>
						<input
							type="date"
							value={draft.started_at ?? ""}
							onChange={(e) =>
								setDraft((d) => ({ ...d, started_at: e.target.value }))
							}
							className="rounded bg-gray-800 p-2 text-sm"
						/>
						<input
							type="date"
							value={draft.ended_at ?? ""}
							onChange={(e) =>
								setDraft((d) => ({ ...d, ended_at: e.target.value }))
							}
							className="rounded bg-gray-800 p-2 text-sm"
						/>
						<button
							type="button"
							onClick={handleAdd}
							className="rounded bg-purple-600 px-3 py-2 text-sm font-medium hover:bg-purple-700"
						>
							Add
						</button>
					</div>
					<input
						type="text"
						placeholder="Note (optional)"
						value={draft.note ?? ""}
						onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
						className="mt-2 w-full rounded bg-gray-800 p-2 text-sm"
					/>
				</div>

				<div className="max-h-[50vh] overflow-y-auto">
					{isLoading ? (
						<p className="text-sm text-gray-400">Loading...</p>
					) : entries.length === 0 ? (
						<p className="text-sm text-gray-400">No past roles recorded.</p>
					) : (
						<table className="w-full border-collapse text-sm">
							<thead className="bg-gray-800 text-left">
								<tr>
									<th className="p-2">Role</th>
									<th className="p-2">Semester</th>
									<th className="p-2">From</th>
									<th className="p-2">To</th>
									<th className="p-2">Note</th>
									<th className="p-2" />
								</tr>
							</thead>
							<tbody>
								{entries.map((entry) => (
									<tr
										key={entry.id}
										className="border-b border-gray-800 align-top"
									>
										<td className="p-2 font-medium">{entry.role}</td>
										<td className="p-2">{entry.semester ?? "—"}</td>
										<td className="p-2">{entry.started_at ?? "—"}</td>
										<td className="p-2">{entry.ended_at ?? "—"}</td>
										<td className="p-2">{entry.note ?? ""}</td>
										<td className="p-2">
											<button
												type="button"
												onClick={() => deleteEntry(entry.id)}
												className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-800"
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}

export default function AdminDatabaseView() {
	const { showToast } = useToast();
	const { members, isLoading, error, updateRole } = useAdminData();
	const [historyMember, setHistoryMember] = useState<Member | null>(null);

	const [filters, setFilters] = useState<Filters>({
		search: "",
		mandateAgreed: "",
		privacyAgreed: "",
		// Default: show everyone (active + alumni). This is the "All Members"
		// tab behaviour requested for this release.
		activeOnly: false,
		department: "",
		role: "",
	});
	const [sortBy, setSortBy] = useState<string>("surname");
	const [sortAsc, setSortAsc] = useState(true);

	const filtered = useMemo(() => {
		if (!members) return [];
		return (members || [])
			.filter((row) => {
				const {
					search,
					mandateAgreed,
					privacyAgreed,
					activeOnly,
					department,
					role,
				} = filters;
				const text =
					`${row.surname} ${row.given_name} ${row.email} ${row.phone} ${row.sepa?.iban || ""} ${row.sepa?.bic || ""} ${row.sepa?.bank_name || ""}`.toLowerCase();

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
				if (activeOnly && !row.active) return false;
				if (department && row.department !== department) return false;
				if (role && row.member_role !== role) return false;

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
	}, [members, filters, sortBy, sortAsc]);

	if (isLoading)
		return <div className="text-white text-center p-8">Loading data...</div>;
	if (error)
		return (
			<div className="text-red-500 text-center p-8">Error: {error.message}</div>
		);

	function getRowStyle(member: Member) {
		if (!member.active || member.member_role === "Alumni") {
			return "bg-slate-600 text-white";
		}
		if (member.sepa?.mandate_agreed) {
			return "bg-green-700 text-white";
		}
		return "bg-orange-500 text-white";
	}

	async function handleRoleChange(member: Member, newRole: MemberRole) {
		if (newRole === member.member_role) return;

		const confirmMsg = `Change ${member.given_name} ${member.surname}'s role to "${newRole}"?${
			newRole === "Alumni" ? "\n\nThis will also mark them as inactive." : ""
		}`;
		if (!window.confirm(confirmMsg)) return;

		try {
			await updateRole({ userId: member.user_id, role: newRole });
			showToast(`Role updated to ${newRole}`, "success");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update role: ${msg}`, "error");
		}
	}

	function exportToCsv() {
		const columns = [
			"Surname",
			"Given Name",
			"Email",
			"Phone",
			"Department",
			"Role",
			"Batch",
			"Degree",
			"School",
			"IBAN",
			"BIC",
			"Bank Name",
			"SEPA Mandate",
			"Privacy Agreed",
			"Active",
		];
		const rows = filtered.map((m) => ({
			Surname: m.surname,
			"Given Name": m.given_name,
			Email: m.email,
			Phone: m.phone,
			Department: m.department || "",
			Role: m.member_role || "",
			Batch: m.batch || "",
			Degree: m.degree || "",
			School: m.school || "",
			IBAN: m.sepa?.iban || "",
			BIC: m.sepa?.bic || "",
			"Bank Name": m.sepa?.bank_name || "",
			"SEPA Mandate": String(m.sepa?.mandate_agreed ?? false),
			"Privacy Agreed": String(m.sepa?.privacy_agreed ?? false),
			Active: String(m.active),
		}));

		const csv = rowsToCsv(rows, columns);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "members_export.csv";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function exportToExcel() {
		const exportData = filtered.map((member) => ({
			Surname: member.surname,
			"Given Name": member.given_name,
			Email: member.email,
			Phone: member.phone,
			Department: member.department || "",
			Role: member.member_role || "",
			Batch: member.batch || "",
			Degree: member.degree || "",
			School: member.school || "",
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
					<span>Department:</span>
					<select
						value={filters.department}
						onChange={(e) =>
							setFilters((f) => ({ ...f, department: e.target.value }))
						}
						className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
					>
						<option value="">All</option>
						{DEPARTMENTS.map((d) => (
							<option key={d} value={d}>
								{d}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2">
					<span>Role:</span>
					<select
						value={filters.role}
						onChange={(e) =>
							setFilters((f) => ({ ...f, role: e.target.value }))
						}
						className="p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
					>
						<option value="">All</option>
						{MEMBER_ROLES.map((r) => (
							<option key={r} value={r}>
								{r}
							</option>
						))}
					</select>
				</div>

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

				<label className="flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						checked={filters.activeOnly}
						onChange={(e) =>
							setFilters((f) => ({ ...f, activeOnly: e.target.checked }))
						}
						className="h-4 w-4"
					/>
					Active only (hide Alumni)
				</label>
			</div>

			<div className="flex gap-4 mb-6 flex-wrap">
				<button
					type="button"
					onClick={exportToCsv}
					className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors"
				>
					Export CSV
				</button>
				<button
					type="button"
					onClick={exportToExcel}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors"
				>
					Export Excel
				</button>
				<button
					type="button"
					onClick={downloadEmails}
					className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded font-medium transition-colors"
				>
					Download Filtered Emails
				</button>
				<span className="ml-auto self-center text-gray-300">
					{filtered.length} of {members?.length ?? 0} members
				</span>
			</div>

			<div className="overflow-x-auto rounded-lg border border-gray-700">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="bg-gray-900 text-left">
							{[
								{ key: "surname", label: "Surname" },
								{ key: "given_name", label: "Given Name" },
								{ key: "email", label: "Email" },
								{ key: "department", label: "Department" },
								{ key: "member_role", label: "Role" },
								{ key: "iban", label: "IBAN" },
								{ key: "bank_name", label: "Bank" },
								{ key: "mandate_agreed", label: "SEPA" },
								{ key: "privacy_agreed", label: "Privacy" },
								{ key: "active", label: "Active" },
								{ key: "actions", label: "" },
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
								<td className="p-3">{row.department || "—"}</td>
								<td className="p-3">
									<select
										value={(row.member_role as MemberRole | null) || "Member"}
										onChange={(e) =>
											handleRoleChange(row, e.target.value as MemberRole)
										}
										className="p-1 rounded bg-gray-900 border border-gray-600 text-white text-xs"
									>
										{MEMBER_ROLES.map((r) => (
											<option key={r} value={r}>
												{r}
											</option>
										))}
									</select>
								</td>
								<td className="p-3">{row.sepa?.iban || ""}</td>
								<td className="p-3">{row.sepa?.bank_name || ""}</td>
								<td className="p-3">
									{String(row.sepa?.mandate_agreed ?? false)}
								</td>
								<td className="p-3">
									{String(row.sepa?.privacy_agreed ?? false)}
								</td>
								<td className="p-3">{String(row.active)}</td>
								<td className="p-3">
									<button
										type="button"
										onClick={() => setHistoryMember(row)}
										className="rounded bg-gray-900 px-2 py-1 text-xs hover:bg-gray-700"
									>
										History
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

			{historyMember && (
				<RoleHistoryPanel
					member={historyMember}
					onClose={() => setHistoryMember(null)}
				/>
			)}
		</div>
	);
}
