import {
	Check,
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	Download,
	ExternalLink,
	Landmark,
	Link2,
	Mail,
	Pencil,
	Search,
	Shield,
	ShieldCheck,
	Users,
	X,
} from "lucide-react";
import { type ReactElement, type ReactNode, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GlassCard from "@/components/ui/GlassCard";
import { InfoBox } from "@/components/ui/info-box";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { proxiedAvatarUrl } from "@/lib/avatarUrl";
import { cn } from "@/lib/utils";
import { useToast } from "../../contexts/ToastContext";
import { useAdminData } from "../../hooks/useAdminData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import {
	BATCH_OPTIONS,
	BOARD_MEMBER_ROLE,
	DEPARTMENTS,
	MEMBER_ROLES,
} from "../../lib/constants";
import { isLinkedinProfileUrl } from "../../lib/linkedin";
import {
	getMemberStatusLabel,
	getOperationalDepartment,
	isExecutiveMemberRole,
	MEMBER_STATUSES,
	requiresDepartmentForMemberRole,
	resolveDepartmentForMemberRole,
} from "../../lib/memberMetadata";
import { getResearchProjectSelectValue } from "../../lib/researchProjects";
import {
	ACTIVE_FILTER_OPTIONS,
	type AdminFilters,
	type AdminMember,
	type AdminSortKey,
	BOOLEAN_FILTER_OPTIONS,
	filterAdminMembers,
	getAdminMemberInitials,
	hasDataPrivacyNoticeAgreement,
	hasMandateAgreement,
	hasPrivacyAgreement,
	sortAdminMembers,
} from "./adminUtils";
import DepartmentPermissionsCard from "./DepartmentPermissionsCard";

// Radix Select forbids an empty-string item value, so the editor's "clear"
// options carry a sentinel that maps back to "" in the change handlers.
const NONE_VALUE = "__none__";
// The filter dropdowns expose an "All" option that the underlying filter state
// represents as "". Same sentinel-mapping trick as above.
const ALL_VALUE = "__all__";

const initialFilters: AdminFilters = {
	search: "",
	mandateAgreed: "",
	privacyAgreed: "",
	dataPrivacyNoticeAgreed: "",
	active: "",
};

const sortableColumns: Array<{
	key: AdminSortKey;
	label: string;
	width?: number;
}> = [
	{ key: "surname", label: "Member", width: 260 },
	{ key: "department", label: "Department", width: 160 },
	{ key: "member_role", label: "Role", width: 160 },
	{ key: "board_role", label: "Board", width: 140 },
	{ key: "phone", label: "Phone", width: 150 },
	{ key: "linkedin_profile_url", label: "LinkedIn", width: 120 },
	{ key: "public_location", label: "Public location", width: 170 },
	{ key: "iban", label: "IBAN", width: 220 },
	{ key: "bic", label: "BIC", width: 150 },
	{ key: "bank_name", label: "Bank", width: 180 },
	{ key: "mandate_agreed", label: "SEPA", width: 140 },
	{ key: "privacy_agreed", label: "Privacy", width: 140 },
	{ key: "data_privacy_notice_agreed", label: "Data Privacy", width: 170 },
	{ key: "active", label: "Status", width: 140 },
];

export default function AdminDatabaseView() {
	const { showToast } = useToast();
	const {
		members,
		totalMembers,
		isLoading,
		isLoadingMoreMembers,
		isRefreshingMembers,
		error,
		updateMemberAsync,
		isSavingMember,
	} = useAdminData();

	const [filters, setFilters] = useState<AdminFilters>(initialFilters);
	const [sortBy, setSortBy] = useState<AdminSortKey>("surname");
	const [sortAsc, setSortAsc] = useState(true);
	const [memberBeingEdited, setMemberBeingEdited] =
		useState<AdminMember | null>(null);
	const [editDepartment, setEditDepartment] = useState("");
	const [editRole, setEditRole] = useState("Member");
	const [editBatch, setEditBatch] = useState("");
	const [editResearchProjectId, setEditResearchProjectId] = useState("");
	const [editIsBoardMember, setEditIsBoardMember] = useState(false);
	const [editStatus, setEditStatus] = useState("active");
	const [editAccessRole, setEditAccessRole] = useState<"user" | "admin">(
		"user",
	);
	const [editLinkedinUrl, setEditLinkedinUrl] = useState("");
	const [editLocation, setEditLocation] = useState("");

	const { researchProjects, isLoading: isLoadingResearchProjects } =
		useResearchProjects();

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

	if (isLoading) return <AdminDatabaseSkeleton />;
	if (error)
		return (
			<div>
				<GlassCard variant="elevated">
					<div className="p-8 text-center">
						<p className="mb-1 font-bold text-destructive">
							Unable to load the admin workspace
						</p>
						<p className="text-muted-foreground">{error.message}</p>
					</div>
				</GlassCard>
			</div>
		);

	function handleSortChange(column: AdminSortKey) {
		setSortBy(column);
		setSortAsc((previousValue) => (sortBy === column ? !previousValue : true));
	}

	function getResolvedStatus(member: AdminMember): string {
		return member.member_status || (member.active ? "active" : "inactive");
	}

	function openMemberEditor(member: AdminMember) {
		setMemberBeingEdited(member);
		setEditRole(member.member_role || "Member");
		setEditDepartment(
			isExecutiveMemberRole(member.member_role)
				? ""
				: getOperationalDepartment(member.department) || "",
		);
		setEditBatch(member.batch || "");
		setEditResearchProjectId(member.research_project_id || "");
		setEditIsBoardMember(member.board_role === BOARD_MEMBER_ROLE);
		setEditStatus(getResolvedStatus(member));
		setEditAccessRole(member.access_role === "admin" ? "admin" : "user");
		setEditLinkedinUrl(member.linkedin_profile_url || "");
		setEditLocation(member.public_location || "");
	}

	async function saveMemberChanges() {
		if (!memberBeingEdited || isMissingRequiredDepartment) return;

		const effectiveDepartment = resolveDepartmentForMemberRole(
			editRole,
			editDepartment || null,
		);

		try {
			await updateMemberAsync({
				userId: memberBeingEdited.user_id,
				department: effectiveDepartment,
				member_role: editRole,
				board_role: editIsBoardMember ? BOARD_MEMBER_ROLE : null,
				member_status: editStatus,
				access_role: editAccessRole,
				batch: editBatch || null,
				research_project_id:
					effectiveDepartment === "Research"
						? editResearchProjectId || null
						: null,
				linkedin_profile_url: editLinkedinUrl.trim() || null,
				public_location: editLocation.trim() || null,
			});
			showToast("Member updated successfully", "success");
			setMemberBeingEdited(null);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update member: ${errorMessage}`, "error");
		}
	}

	function exportToExcel() {
		const exportData = buildExportRows(filtered);
		const worksheet = XLSX.utils.json_to_sheet(exportData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
		XLSX.writeFile(workbook, "members_export.xlsx");
	}

	function exportToCsv() {
		const exportData = buildExportRows(filtered);
		const csv = rowsToCsv(exportData);
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

	function buildExportRows(rows: AdminMember[]) {
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
			"Privacy Agreed": hasPrivacyAgreement(member)
				? "Accepted"
				: "Not accepted",
			"Data Privacy Notice": hasDataPrivacyNoticeAgreement(member)
				? "Accepted"
				: "Not accepted",
			Status: getMemberStatusLabel(
				member.member_status || (member.active ? "active" : "inactive"),
			),
		}));
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

	const editRoleNeedsDepartment = requiresDepartmentForMemberRole(editRole);
	const editRoleIsExecutive = isExecutiveMemberRole(editRole);
	const editEffectiveDepartment = resolveDepartmentForMemberRole(
		editRole,
		editDepartment || null,
	);
	const existingEditRole = memberBeingEdited?.member_role || "Member";
	const existingEditDepartment = memberBeingEdited
		? resolveDepartmentForMemberRole(
				existingEditRole,
				getOperationalDepartment(memberBeingEdited.department) || null,
			)
		: null;
	const isPreservingMissingRequiredDepartment = Boolean(
		memberBeingEdited &&
			editRoleNeedsDepartment &&
			!editDepartment &&
			editRole === existingEditRole &&
			!existingEditDepartment,
	);
	const isMissingRequiredDepartment =
		editRoleNeedsDepartment &&
		!editDepartment &&
		!isPreservingMissingRequiredDepartment;
	const editIsResearchDepartment = editEffectiveDepartment === "Research";
	const researchProjectOptions = (researchProjects ?? []).filter((project) => {
		const status = project.status?.trim().toLowerCase();
		return !status || ["ongoing", "active", "in progress"].includes(status);
	});
	const editResearchProjectSelectValue = getResearchProjectSelectValue(
		editResearchProjectId,
		researchProjectOptions,
	);
	const isEditLinkedinUrlInvalid = Boolean(
		editLinkedinUrl.trim() && !isLinkedinProfileUrl(editLinkedinUrl),
	);
	const isMemberSaveDisabled =
		isSavingMember || isMissingRequiredDepartment || isEditLinkedinUrlInvalid;
	const memberLoadingMessage = isLoadingMoreMembers
		? `Loaded ${loadedMemberCount} of ${totalMemberCount} members. Loading the rest in the background...`
		: isRefreshingMembers
			? `Refreshing ${filtered.length} matching member${filtered.length === 1 ? "" : "s"}...`
			: `${filtered.length} member${filtered.length === 1 ? "" : "s"} match the current filters.`;

	return (
		<div>
			<GlassCard variant="elevated" className="mb-8 overflow-hidden">
				<div className="p-6 md:p-8">
					<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
						<div className="max-w-[680px]">
							<h1 className="mb-2.5 text-3xl font-bold">Admin Workspace</h1>
							<p className="text-muted-foreground">
								Review membership records, agreement status, and banking data.
							</p>
						</div>
					</div>

					<div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<MetricCard
							icon={<Users className="size-4" />}
							label="Total members"
							value={stats.total}
						/>
						<MetricCard
							icon={<ShieldCheck className="size-4" />}
							label="Active members"
							value={stats.active}
						/>
						<MetricCard
							icon={<Landmark className="size-4" />}
							label="SEPA accepted"
							value={stats.sepaAccepted}
						/>
						<MetricCard
							icon={<Shield className="size-4" />}
							label="Privacy accepted"
							value={stats.privacyAccepted}
						/>
					</div>
				</div>
			</GlassCard>

			<DepartmentPermissionsCard />

			<GlassCard className="mb-6">
				<div className="p-6">
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
						<div className="lg:col-span-5">
							<div className="grid gap-1.5">
								<Label htmlFor="admin-search">Search members</Label>
								<div className="relative">
									<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="admin-search"
										className="pl-9"
										placeholder="Name, email, phone, IBAN, department..."
										value={filters.search}
										onChange={(event) =>
											setFilters((currentValue) => ({
												...currentValue,
												search: event.target.value,
											}))
										}
									/>
								</div>
							</div>
						</div>

						<FilterSelect
							className="sm:col-span-4 lg:col-span-2"
							label="SEPA mandate"
							value={filters.mandateAgreed}
							onValueChange={(value) =>
								setFilters((currentValue) => ({
									...currentValue,
									mandateAgreed: value,
								}))
							}
							options={BOOLEAN_FILTER_OPTIONS}
						/>

						<FilterSelect
							className="sm:col-span-4 lg:col-span-2"
							label="Data privacy"
							value={filters.dataPrivacyNoticeAgreed}
							onValueChange={(value) =>
								setFilters((currentValue) => ({
									...currentValue,
									dataPrivacyNoticeAgreed: value,
								}))
							}
							options={BOOLEAN_FILTER_OPTIONS}
						/>

						<FilterSelect
							className="sm:col-span-4 lg:col-span-2"
							label="Privacy policy"
							value={filters.privacyAgreed}
							onValueChange={(value) =>
								setFilters((currentValue) => ({
									...currentValue,
									privacyAgreed: value,
								}))
							}
							options={BOOLEAN_FILTER_OPTIONS}
						/>

						<FilterSelect
							className="sm:col-span-4 lg:col-span-2"
							label="Member state"
							value={filters.active}
							onValueChange={(value) =>
								setFilters((currentValue) => ({
									...currentValue,
									active: value,
								}))
							}
							options={ACTIVE_FILTER_OPTIONS}
						/>
					</div>

					<div className="mt-6 flex flex-col justify-between gap-3 md:flex-row">
						<div />

						<div className="flex flex-col gap-3 sm:flex-row">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button type="button" disabled={filtered.length === 0}>
										<Download className="size-4" />
										Export
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="min-w-[180px]">
									<DropdownMenuItem onSelect={() => exportToCsv()}>
										Export as CSV
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => exportToExcel()}>
										Export as Excel
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<Button
								type="button"
								variant="outline"
								onClick={downloadEmails}
								disabled={filtered.length === 0}
							>
								<Mail className="size-4" />
								Download emails
							</Button>
						</div>
					</div>
				</div>
			</GlassCard>

			<GlassCard variant="elevated" className="mb-6 overflow-hidden">
				<div className="px-6 pt-6 pb-4">
					<h2 className="text-lg font-semibold">Members</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{memberLoadingMessage}
					</p>
				</div>
				<div className="w-full overflow-x-auto">
					<Table className="min-w-[1620px]">
						<TableHeader>
							<TableRow>
								{sortableColumns.map((column) => {
									const isActive = sortBy === column.key;
									const SortIcon = !isActive
										? ChevronsUpDown
										: sortAsc
											? ChevronUp
											: ChevronDown;
									return (
										<TableHead
											key={column.key}
											className="border-b bg-card"
											style={{ minWidth: column.width }}
										>
											<button
												type="button"
												onClick={() => handleSortChange(column.key)}
												className={cn(
													"inline-flex items-center gap-1 font-medium",
													isActive
														? "text-foreground"
														: "text-muted-foreground",
												)}
											>
												{column.label}
												<SortIcon className="size-4" />
											</button>
										</TableHead>
									);
								})}
							</TableRow>
						</TableHeader>

						<TableBody>
							{filtered.map((row) => {
								const sepaAccepted = hasMandateAgreement(row);
								const privacyAccepted = hasPrivacyAgreement(row);
								const dataPrivacyNoticeAccepted =
									hasDataPrivacyNoticeAgreement(row);
								const fullName =
									`${row.given_name} ${row.surname}`.trim() || "Unnamed member";
								const memberStatus = getResolvedStatus(row);

								return (
									<TableRow
										key={row.user_id}
										className={cn(
											memberStatus !== "active" && "opacity-[0.84]",
										)}
									>
										<TableCell>
											<div className="flex flex-row items-center gap-3">
												<Button
													type="button"
													variant="ghost"
													size="icon-sm"
													onClick={() => openMemberEditor(row)}
													aria-label={`Edit member ${fullName}`}
													className="rounded-full text-brand"
												>
													<Pencil className="size-4" />
												</Button>
												<Avatar className="size-11 bg-muted">
													<AvatarImage
														src={proxiedAvatarUrl(row.avatar_url)}
														alt={fullName}
													/>
													<AvatarFallback className="bg-muted font-bold text-foreground">
														{getAdminMemberInitials(row)}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<p className="overflow-hidden font-bold leading-tight text-ellipsis whitespace-nowrap">
														{fullName}
													</p>
													<p className="overflow-hidden text-sm text-muted-foreground text-ellipsis whitespace-nowrap">
														{row.email}
													</p>
												</div>
											</div>
										</TableCell>

										<TableCell>
											{getOperationalDepartment(row.department) || "—"}
										</TableCell>
										<TableCell>{row.member_role || "Member"}</TableCell>
										<TableCell>
											{row.board_role === BOARD_MEMBER_ROLE ? (
												<Badge variant="accent" className="font-semibold">
													{BOARD_MEMBER_ROLE}
												</Badge>
											) : (
												"—"
											)}
										</TableCell>
										<TableCell>{row.phone || "—"}</TableCell>
										<TableCell>
											{isLinkedinProfileUrl(row.linkedin_profile_url) ? (
												<Button
													variant="ghost"
													size="sm"
													asChild
													className="px-2 text-brand"
												>
													<a
														href={row.linkedin_profile_url.trim()}
														target="_blank"
														rel="noopener noreferrer"
													>
														<ExternalLink className="size-4" />
														View
													</a>
												</Button>
											) : (
												"—"
											)}
										</TableCell>
										<TableCell>{row.public_location || "—"}</TableCell>
										<TableCell className="font-mono">
											{row.sepa?.iban || "—"}
										</TableCell>
										<TableCell className="font-mono">
											{row.sepa?.bic || "—"}
										</TableCell>
										<TableCell>{row.sepa?.bank_name || "—"}</TableCell>
										<TableCell>
											<AgreementChip accepted={sepaAccepted} />
										</TableCell>
										<TableCell>
											<AgreementChip accepted={privacyAccepted} />
										</TableCell>
										<TableCell>
											<AgreementChip accepted={dataPrivacyNoticeAccepted} />
										</TableCell>
										<TableCell>
											<Badge
												variant={
													memberStatus === "active" ? "accent" : "neutral"
												}
												className="font-semibold"
											>
												{getMemberStatusLabel(memberStatus)}
											</Badge>
										</TableCell>
									</TableRow>
								);
							})}

							{filtered.length === 0 && (
								<TableRow>
									<TableCell colSpan={sortableColumns.length}>
										<div className="py-14 text-center">
											<p className="mb-1 font-bold">
												No members match the current filters
											</p>
											<p className="text-muted-foreground">
												Try broadening the search or resetting the agreement
												filters.
											</p>
										</div>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</GlassCard>

			<Dialog
				open={Boolean(memberBeingEdited)}
				onOpenChange={(open) => {
					if (!open && !isSavingMember) {
						setMemberBeingEdited(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Edit member</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 pt-1">
						<p className="text-muted-foreground">
							{memberBeingEdited
								? `Update ${memberBeingEdited.given_name} ${memberBeingEdited.surname}.`
								: ""}
						</p>
						{/* ── LinkedIn & Professional ── */}
						<p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
							<Link2 className="size-4 text-brand" />
							LinkedIn & Professional
						</p>
						<div className="grid gap-1.5">
							<Label htmlFor="edit-linkedin">LinkedIn Profile URL</Label>
							<Input
								id="edit-linkedin"
								placeholder="https://linkedin.com/in/your-profile"
								value={editLinkedinUrl}
								onChange={(e) => setEditLinkedinUrl(e.target.value)}
								aria-invalid={isEditLinkedinUrlInvalid}
							/>
							{isEditLinkedinUrlInvalid && (
								<p className="text-xs text-destructive">
									Use a LinkedIn profile URL like https://linkedin.com/in/name.
								</p>
							)}
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="edit-location">Public location</Label>
							<Input
								id="edit-location"
								placeholder="Munich, Germany"
								value={editLocation}
								onChange={(e) => setEditLocation(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Shown on the member profile; separate from address fields.
							</p>
						</div>
						<Separator />
						{/* ── Org fields ── */}
						<div className="grid gap-1.5">
							<Label htmlFor="edit-batch">Batch</Label>
							<Select
								value={editBatch || NONE_VALUE}
								onValueChange={(value) =>
									setEditBatch(value === NONE_VALUE ? "" : value)
								}
							>
								<SelectTrigger
									id="edit-batch"
									aria-label="Batch"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE_VALUE}>None</SelectItem>
									{BATCH_OPTIONS.map((batch) => (
										<SelectItem key={batch} value={batch}>
											{batch}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Member's TUM.ai joining semester.
							</p>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="edit-department">Department</Label>
							<Select
								value={editDepartment || NONE_VALUE}
								onValueChange={(value) => {
									const nextValue = value === NONE_VALUE ? "" : value;
									setEditDepartment(nextValue);
									if (nextValue !== "Research") {
										setEditResearchProjectId("");
									}
								}}
								disabled={editRoleIsExecutive}
							>
								<SelectTrigger
									id="edit-department"
									aria-label="Department"
									aria-invalid={isMissingRequiredDepartment}
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE_VALUE}>None</SelectItem>
									{DEPARTMENTS.map((department) => (
										<SelectItem key={department} value={department}>
											{department}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p
								className={cn(
									"text-xs",
									isMissingRequiredDepartment
										? "text-destructive"
										: "text-muted-foreground",
								)}
							>
								{editRoleIsExecutive
									? "President and Vice-President are not assigned to a department."
									: isMissingRequiredDepartment
										? "Select a department for Member and Team Lead roles."
										: isPreservingMissingRequiredDepartment
											? "No department assigned yet; keep the role unchanged to save this profile update."
											: "Operational home. Board membership is assigned separately."}
							</p>
						</div>
						{editIsResearchDepartment && (
							<div className="grid gap-1.5">
								<Label htmlFor="edit-research-project">Research project</Label>
								<Select
									value={editResearchProjectSelectValue || NONE_VALUE}
									onValueChange={(value) =>
										setEditResearchProjectId(value === NONE_VALUE ? "" : value)
									}
									disabled={isLoadingResearchProjects}
								>
									<SelectTrigger
										id="edit-research-project"
										aria-label="Research project"
										className="w-full"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE_VALUE}>
											No project selected
										</SelectItem>
										{researchProjectOptions.map((project) => (
											<SelectItem key={project.id} value={project.id}>
												{project.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground">
									Research project assignment for org chart grouping.
								</p>
							</div>
						)}
						<div className="grid gap-1.5">
							<Label htmlFor="edit-role">Role</Label>
							<Select
								value={editRole}
								onValueChange={(nextRole) => {
									setEditRole(nextRole);
									if (isExecutiveMemberRole(nextRole)) {
										setEditDepartment("");
										setEditResearchProjectId("");
									}
								}}
							>
								<SelectTrigger
									id="edit-role"
									aria-label="Role"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MEMBER_ROLES.map((role) => (
										<SelectItem key={role} value={role}>
											{role}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="edit-board-member"
									checked={editIsBoardMember}
									onCheckedChange={(checked) =>
										setEditIsBoardMember(checked === true)
									}
								/>
								<Label htmlFor="edit-board-member">Board member</Label>
							</div>
							<p className="text-xs text-muted-foreground">
								Additional responsibility. It does not change the department or
								the internal team lead/member role.
							</p>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="edit-status">Status</Label>
							<Select value={editStatus} onValueChange={setEditStatus}>
								<SelectTrigger
									id="edit-status"
									aria-label="Status"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{MEMBER_STATUSES.map((status) => (
										<SelectItem key={status} value={status}>
											{getMemberStatusLabel(status)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="edit-access">Access</Label>
							<Select
								value={editAccessRole}
								onValueChange={(value) =>
									setEditAccessRole(value as "user" | "admin")
								}
							>
								<SelectTrigger
									id="edit-access"
									aria-label="Access"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="user">User</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setMemberBeingEdited(null)}
							disabled={isSavingMember}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={saveMemberChanges}
							disabled={isMemberSaveDisabled}
						>
							{isSavingMember ? "Saving..." : "Save member changes"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

interface FilterSelectProps {
	className?: string;
	label: string;
	value: string;
	onValueChange: (value: string) => void;
	options: ReadonlyArray<{ label: string; value: string }>;
}

function FilterSelect({
	className,
	label,
	value,
	onValueChange,
	options,
}: FilterSelectProps): ReactElement {
	const selectedLabel =
		options.find((option) => option.value === value)?.label ?? "All";
	return (
		<div className={className}>
			<div className="grid gap-1.5">
				<Label>{label}</Label>
				<Select
					value={value || ALL_VALUE}
					onValueChange={(next) =>
						onValueChange(next === ALL_VALUE ? "" : next)
					}
				>
					<SelectTrigger aria-label={label} className="w-full">
						<SelectValue>{selectedLabel}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{options.map((option) => (
							<SelectItem
								key={option.value || ALL_VALUE}
								value={option.value || ALL_VALUE}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

interface MetricCardProps {
	icon: ReactNode;
	label: string;
	value: number;
}

function MetricCard({ icon, label, value }: MetricCardProps) {
	return (
		<InfoBox variant="brand" className="flex items-center gap-3 p-4">
			<div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
				{icon}
			</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-2xl font-semibold">{value}</p>
			</div>
		</InfoBox>
	);
}

function AgreementChip({ accepted }: { accepted: boolean }) {
	const label = accepted ? "Accepted" : "Not accepted";
	return (
		<span role="img" title={label} aria-label={label} className="inline-flex">
			{accepted ? (
				<Check className="size-4 text-brand" aria-hidden="true" />
			) : (
				<X className="size-4 text-muted-foreground" aria-hidden="true" />
			)}
		</span>
	);
}

function rowsToCsv(rows: Array<Record<string, string>>): string {
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

function escapeCsvCell(value: string): string {
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

export function AdminDatabaseSkeleton() {
	return (
		<SkeletonRegion label="Loading admin workspace">
			<GlassCard variant="elevated" className="mb-8 overflow-hidden">
				<div className="p-6 md:p-8">
					<div className="max-w-[680px] space-y-2.5">
						<Skeleton className="h-9 w-64" />
						<Skeleton className="h-4 w-[28rem] max-w-full" />
					</div>
					<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
								key={i}
								className="flex items-center gap-3 rounded-lg border p-4"
							>
								<Skeleton className="size-10 shrink-0 rounded-lg" />
								<div className="space-y-1.5">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-6 w-12" />
								</div>
							</div>
						))}
					</div>
				</div>
			</GlassCard>

			<GlassCard variant="elevated" className="mb-6 overflow-hidden">
				<div className="flex items-center gap-6 border-b bg-muted/40 px-6 py-3">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<Skeleton key={i} className="h-4 flex-1" />
					))}
				</div>
				{Array.from({ length: 8 }).map((_, row) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						key={row}
						className="flex items-center gap-6 border-b px-6 py-4 last:border-b-0"
					>
						<div className="flex flex-1 items-center gap-3">
							<Skeleton className="size-9 shrink-0 rounded-full" />
							<Skeleton className="h-4 flex-1" />
						</div>
						{Array.from({ length: 6 }).map((_, col) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<Skeleton key={col} className="h-4 flex-1" />
						))}
					</div>
				))}
			</GlassCard>
		</SkeletonRegion>
	);
}
