import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import {
	Avatar,
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Grid,
	InputAdornment,
	MenuItem,
	MenuList,
	Popover,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TableSortLabel,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useAdminData } from "../../hooks/useAdminData";
import { DEPARTMENTS, MEMBER_ROLES } from "../../lib/constants";
import {
	getMemberStatusLabel,
	isBoardLeadershipRole,
	MEMBER_STATUSES,
	resolveDepartmentForMemberRole,
} from "../../lib/memberMetadata";
import {
	ACTIVE_FILTER_OPTIONS,
	type AdminFilters,
	type AdminMember,
	type AdminSortKey,
	BOOLEAN_FILTER_OPTIONS,
	filterAdminMembers,
	getAdminMemberInitials,
	hasMandateAgreement,
	hasPrivacyAgreement,
	sortAdminMembers,
} from "./adminUtils";

const initialFilters: AdminFilters = {
	search: "",
	mandateAgreed: "",
	privacyAgreed: "",
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
	{ key: "phone", label: "Phone", width: 150 },
	{ key: "iban", label: "IBAN", width: 220 },
	{ key: "bic", label: "BIC", width: 150 },
	{ key: "bank_name", label: "Bank", width: 180 },
	{ key: "mandate_agreed", label: "SEPA", width: 140 },
	{ key: "privacy_agreed", label: "Privacy", width: 140 },
	{ key: "active", label: "Status", width: 140 },
];

export default function AdminDatabaseView() {
	const theme = useTheme();
	const { showToast } = useToast();
	const {
		members,
		changeRequests,
		certificateRequests,
		isLoading,
		error,
		updateDepartmentAsync,
		updateRoleAsync,
		updateStatusAsync,
		updateAccessRoleAsync,
		reviewChangeRequestAsync,
		reviewCertificateRequestAsync,
		isSavingMember,
		isReviewingChangeRequest,
		isReviewingCertificateRequest,
	} = useAdminData();

	const [filters, setFilters] = useState<AdminFilters>(initialFilters);
	const [sortBy, setSortBy] = useState<AdminSortKey>("surname");
	const [sortAsc, setSortAsc] = useState(true);
	const [memberBeingEdited, setMemberBeingEdited] =
		useState<AdminMember | null>(null);
	const [editDepartment, setEditDepartment] = useState("");
	const [editRole, setEditRole] = useState("Member");
	const [editStatus, setEditStatus] = useState("active");
	const [editAccessRole, setEditAccessRole] = useState<"user" | "admin">(
		"user",
	);
	const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(
		null,
	);

	const allMembers = members ?? [];
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
			total: allMembers.length,
			active: allMembers.filter((member) => member.active).length,
			sepaAccepted: allMembers.filter((member) => hasMandateAgreement(member))
				.length,
			privacyAccepted: allMembers.filter((member) =>
				hasPrivacyAgreement(member),
			).length,
		}),
		[allMembers],
	);

	if (isLoading)
		return (
			<Box sx={{ py: 2 }}>
				<GlassCard variant="elevated">
					<CardContent
						sx={{
							p: 4,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 2,
						}}
					>
						<CircularProgress size={24} />
						<Typography color="text.secondary">
							Loading admin workspace...
						</Typography>
					</CardContent>
				</GlassCard>
			</Box>
		);
	if (error)
		return (
			<Box sx={{ py: 2 }}>
				<GlassCard variant="elevated">
					<CardContent sx={{ p: 4, textAlign: "center" }}>
						<Typography color="error" sx={{ fontWeight: 700, mb: 1 }}>
							Unable to load the admin workspace
						</Typography>
						<Typography color="text.secondary">{error.message}</Typography>
					</CardContent>
				</GlassCard>
			</Box>
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
		setEditDepartment(member.department || "");
		setEditRole(member.member_role || "Member");
		setEditStatus(getResolvedStatus(member));
		setEditAccessRole(member.access_role === "admin" ? "admin" : "user");
	}

	function getMemberDisplayName(userId: string): string {
		const member = allMembers.find((entry) => entry.user_id === userId);
		if (!member) {
			return userId;
		}

		return `${member.given_name} ${member.surname}`.trim() || userId;
	}

	function formatRequestedChanges(changes: Record<string, unknown>): string {
		const requestedRole =
			typeof changes.member_role === "string" ? changes.member_role : undefined;
		const effectiveDepartment =
			Object.hasOwn(changes, "department") || requestedRole
				? resolveDepartmentForMemberRole(
						requestedRole,
						typeof changes.department === "string" ||
							changes.department === null
							? changes.department
							: undefined,
					)
				: undefined;
		const entries: Array<[string, string]> = [];

		if (effectiveDepartment !== undefined) {
			entries.push(["department", effectiveDepartment ?? "None"]);
		}
		if (typeof changes.member_role === "string") {
			entries.push(["member_role", changes.member_role]);
		}
		if (typeof changes.degree === "string") {
			entries.push(["degree", changes.degree]);
		}
		if (typeof changes.school === "string") {
			entries.push(["school", changes.school]);
		}
		if (typeof changes.batch === "string") {
			entries.push(["batch", changes.batch]);
		}

		return entries.map(([field, value]) => `${field}: ${value}`).join(", ");
	}

	async function saveMemberChanges() {
		if (!memberBeingEdited) return;
		const effectiveDepartment = resolveDepartmentForMemberRole(
			editRole,
			editDepartment || null,
		);

		try {
			await Promise.all([
				updateDepartmentAsync({
					userId: memberBeingEdited.user_id,
					department: effectiveDepartment,
				}),
				updateRoleAsync({
					userId: memberBeingEdited.user_id,
					member_role: editRole,
				}),
				updateStatusAsync({
					userId: memberBeingEdited.user_id,
					member_status: editStatus,
				}),
				updateAccessRoleAsync({
					userId: memberBeingEdited.user_id,
					access_role: editAccessRole,
				}),
			]);
			showToast("Member updated successfully", "success");
			setMemberBeingEdited(null);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update member: ${errorMessage}`, "error");
		}
	}

	async function reviewChangeRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		try {
			await reviewChangeRequestAsync({
				requestId,
				decision,
			});
			showToast(`Change request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to review request: ${errorMessage}`, "error");
		}
	}

	async function reviewCertificateRequest(
		requestId: string,
		decision: "approved" | "rejected",
	) {
		try {
			await reviewCertificateRequestAsync({
				requestId,
				decision,
			});
			showToast(`Certificate request ${decision}`, "success");
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(
				`Failed to review certificate request: ${errorMessage}`,
				"error",
			);
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
			Department: member.department || "",
			Role: member.member_role || "",
			IBAN: member.sepa?.iban || "",
			BIC: member.sepa?.bic || "",
			"Bank Name": member.sepa?.bank_name || "",
			"SEPA Mandate": hasMandateAgreement(member) ? "Accepted" : "Not accepted",
			"Privacy Agreed": hasPrivacyAgreement(member)
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

	function closeExportMenu() {
		setExportAnchorEl(null);
	}

	return (
		<Box sx={{ py: 2 }}>
			<GlassCard variant="elevated" sx={{ mb: 4, overflow: "hidden" }}>
				<CardContent sx={{ p: { xs: 3, md: 4 } }}>
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: { xs: "flex-start", md: "center" },
							flexDirection: { xs: "column", md: "row" },
							gap: 3,
						}}
					>
						<Box sx={{ maxWidth: 680 }}>
							<Typography variant="h3" sx={{ mb: 1.25 }}>
								Admin Workspace
							</Typography>
							<Typography variant="body1" color="text.secondary">
								Review membership records, agreement status, and banking data.
							</Typography>
						</Box>
					</Box>

					<Grid container spacing={1.5} sx={{ mt: 0.5 }}>
						<Grid size={{ xs: 12, sm: 6, xl: 3 }}>
							<MetricCard
								icon={<PeopleAltOutlinedIcon fontSize="small" />}
								label="Total members"
								value={stats.total}
							/>
						</Grid>
						<Grid size={{ xs: 12, sm: 6, xl: 3 }}>
							<MetricCard
								icon={<VerifiedUserOutlinedIcon fontSize="small" />}
								label="Active members"
								value={stats.active}
							/>
						</Grid>
						<Grid size={{ xs: 12, sm: 6, xl: 3 }}>
							<MetricCard
								icon={<AccountBalanceOutlinedIcon fontSize="small" />}
								label="SEPA accepted"
								value={stats.sepaAccepted}
							/>
						</Grid>
						<Grid size={{ xs: 12, sm: 6, xl: 3 }}>
							<MetricCard
								icon={<ShieldOutlinedIcon fontSize="small" />}
								label="Privacy accepted"
								value={stats.privacyAccepted}
							/>
						</Grid>
					</Grid>
				</CardContent>
			</GlassCard>

			<GlassCard sx={{ mb: 3 }}>
				<CardContent sx={{ p: 3 }}>
					<Grid container spacing={2}>
						<Grid size={{ xs: 12, lg: 5 }}>
							<TextField
								size="small"
								label="Search members"
								placeholder="Name, email, phone, IBAN, department..."
								value={filters.search}
								onChange={(event) =>
									setFilters((currentValue) => ({
										...currentValue,
										search: event.target.value,
									}))
								}
								slotProps={{
									input: {
										startAdornment: (
											<InputAdornment position="start">
												<SearchIcon fontSize="small" />
											</InputAdornment>
										),
									},
								}}
							/>
						</Grid>

						<Grid size={{ xs: 12, sm: 4, lg: 2 }}>
							<TextField
								select
								size="small"
								label="SEPA mandate"
								value={filters.mandateAgreed}
								onChange={(event) =>
									setFilters((currentValue) => ({
										...currentValue,
										mandateAgreed: event.target.value,
									}))
								}
								slotProps={{
									inputLabel: { shrink: true },
									select: getSelectProps(BOOLEAN_FILTER_OPTIONS),
								}}
							>
								{BOOLEAN_FILTER_OPTIONS.map((option) => (
									<MenuItem key={option.value} value={option.value}>
										{option.label}
									</MenuItem>
								))}
							</TextField>
						</Grid>

						<Grid size={{ xs: 12, sm: 4, lg: 2 }}>
							<TextField
								select
								size="small"
								label="Privacy policy"
								value={filters.privacyAgreed}
								onChange={(event) =>
									setFilters((currentValue) => ({
										...currentValue,
										privacyAgreed: event.target.value,
									}))
								}
								slotProps={{
									inputLabel: { shrink: true },
									select: getSelectProps(BOOLEAN_FILTER_OPTIONS),
								}}
							>
								{BOOLEAN_FILTER_OPTIONS.map((option) => (
									<MenuItem key={option.value} value={option.value}>
										{option.label}
									</MenuItem>
								))}
							</TextField>
						</Grid>

						<Grid size={{ xs: 12, sm: 4, lg: 2 }}>
							<TextField
								select
								size="small"
								label="Member state"
								value={filters.active}
								onChange={(event) =>
									setFilters((currentValue) => ({
										...currentValue,
										active: event.target.value,
									}))
								}
								slotProps={{
									inputLabel: { shrink: true },
									select: getSelectProps(ACTIVE_FILTER_OPTIONS),
								}}
							>
								{ACTIVE_FILTER_OPTIONS.map((option) => (
									<MenuItem key={option.value} value={option.value}>
										{option.label}
									</MenuItem>
								))}
							</TextField>
						</Grid>
					</Grid>

					<Stack
						direction={{ xs: "column", md: "row" }}
						spacing={1.5}
						sx={{ mt: 2.5, justifyContent: "space-between" }}
					>
						<Box />

						<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
							<Button
								type="button"
								variant="contained"
								startIcon={<DownloadIcon />}
								onClick={(event) => setExportAnchorEl(event.currentTarget)}
								disabled={filtered.length === 0}
							>
								Export
							</Button>
							<Button
								type="button"
								variant="outlined"
								startIcon={<EmailOutlinedIcon />}
								onClick={downloadEmails}
								disabled={filtered.length === 0}
							>
								Download emails
							</Button>
						</Stack>
					</Stack>

					<Popover
						open={Boolean(exportAnchorEl)}
						anchorEl={exportAnchorEl}
						onClose={closeExportMenu}
						anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
						transformOrigin={{ vertical: "top", horizontal: "left" }}
					>
						<MenuList sx={{ minWidth: 180 }}>
							<MenuItem
								onClick={() => {
									exportToCsv();
									closeExportMenu();
								}}
							>
								Export as CSV
							</MenuItem>
							<MenuItem
								onClick={() => {
									exportToExcel();
									closeExportMenu();
								}}
							>
								Export as Excel
							</MenuItem>
						</MenuList>
					</Popover>
				</CardContent>
			</GlassCard>

			<Grid container spacing={3} sx={{ mb: 3 }}>
				<Grid size={{ xs: 12, xl: 6 }}>
					<GlassCard sx={{ height: "100%" }}>
						<CardContent sx={{ p: 3 }}>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Member Change Requests
							</Typography>
							<Stack spacing={1.5}>
								{changeRequests.filter(
									(request) => request.status === "pending",
								).length === 0 ? (
									<Typography color="text.secondary">
										No pending member change requests.
									</Typography>
								) : (
									changeRequests
										.filter((request) => request.status === "pending")
										.map((request) => (
											<Box
												key={request.id}
												sx={{
													p: 2,
													borderRadius: 3,
													backgroundColor:
														theme.palette.mode === "light"
															? "rgba(154, 100, 217, 0.06)"
															: "rgba(27, 0, 73, 0.36)",
												}}
											>
												<Typography sx={{ fontWeight: 700, mb: 0.5 }}>
													Request `{request.id}`
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Member: {getMemberDisplayName(request.user_id)}
												</Typography>
												{request.reason && (
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ mt: 0.5 }}
													>
														Reason: {request.reason}
													</Typography>
												)}
												<Typography variant="body2" sx={{ mt: 1 }}>
													Requested changes:{" "}
													{formatRequestedChanges(request.changes)}
												</Typography>
												<Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
													<Button
														type="button"
														variant="contained"
														size="small"
														onClick={() =>
															reviewChangeRequest(request.id, "approved")
														}
														disabled={isReviewingChangeRequest}
														aria-label={`Approve ${request.id}`}
													>
														Approve
													</Button>
													<Button
														type="button"
														variant="outlined"
														size="small"
														onClick={() =>
															reviewChangeRequest(request.id, "rejected")
														}
														disabled={isReviewingChangeRequest}
													>
														Reject
													</Button>
												</Stack>
											</Box>
										))
								)}
							</Stack>
						</CardContent>
					</GlassCard>
				</Grid>

				<Grid size={{ xs: 12, xl: 6 }}>
					<GlassCard sx={{ height: "100%" }}>
						<CardContent sx={{ p: 3 }}>
							<Typography variant="h6" sx={{ mb: 2 }}>
								Engagement Certificate Requests
							</Typography>
							<Stack spacing={1.5}>
								{certificateRequests.filter(
									(request) => request.status === "pending",
								).length === 0 ? (
									<Typography color="text.secondary">
										No pending engagement certificate requests.
									</Typography>
								) : (
									certificateRequests
										.filter((request) => request.status === "pending")
										.map((request) => (
											<Box
												key={request.id}
												sx={{
													p: 2,
													borderRadius: 3,
													backgroundColor:
														theme.palette.mode === "light"
															? "rgba(154, 100, 217, 0.06)"
															: "rgba(27, 0, 73, 0.36)",
												}}
											>
												<Typography sx={{ fontWeight: 700, mb: 0.5 }}>
													Request `{request.id}`
												</Typography>
												<Typography variant="body2" color="text.secondary">
													Member: {getMemberDisplayName(request.user_id)}
												</Typography>
												<Typography variant="body2" sx={{ mt: 1 }}>
													Engagement entries: {request.engagements.length}
												</Typography>
												<Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
													<Button
														type="button"
														variant="contained"
														size="small"
														onClick={() =>
															reviewCertificateRequest(request.id, "approved")
														}
														disabled={isReviewingCertificateRequest}
													>
														Approve
													</Button>
													<Button
														type="button"
														variant="outlined"
														size="small"
														onClick={() =>
															reviewCertificateRequest(request.id, "rejected")
														}
														disabled={isReviewingCertificateRequest}
													>
														Reject
													</Button>
												</Stack>
											</Box>
										))
								)}
							</Stack>
						</CardContent>
					</GlassCard>
				</Grid>
			</Grid>

			<GlassCard variant="elevated" sx={{ overflow: "hidden" }}>
				<TableContainer
					sx={{
						overflowX: "auto",
						overflowY: "visible",
					}}
				>
					<Table size="small" sx={{ minWidth: 1480 }}>
						<TableHead>
							<TableRow>
								{sortableColumns.map((column) => (
									<TableCell
										key={column.key}
										sx={{
											minWidth: column.width,
											backgroundColor:
												theme.palette.mode === "light"
													? alpha(theme.palette.background.paper, 0.98)
													: alpha(theme.palette.background.paper, 0.94),
											borderBottom: `1px solid ${theme.palette.divider}`,
										}}
									>
										<TableSortLabel
											active={sortBy === column.key}
											direction={
												sortBy === column.key && !sortAsc ? "desc" : "asc"
											}
											onClick={() => handleSortChange(column.key)}
										>
											{column.label}
										</TableSortLabel>
									</TableCell>
								))}
							</TableRow>
						</TableHead>

						<TableBody>
							{filtered.map((row) => {
								const sepaAccepted = hasMandateAgreement(row);
								const privacyAccepted = hasPrivacyAgreement(row);
								const fullName =
									`${row.given_name} ${row.surname}`.trim() || "Unnamed member";
								const memberStatus = getResolvedStatus(row);

								return (
									<TableRow
										key={row.user_id}
										hover
										sx={{
											opacity: memberStatus === "active" ? 1 : 0.84,
											transition:
												"background-color 180ms ease, opacity 180ms ease",
											"&:hover": {
												backgroundColor:
													theme.palette.mode === "light"
														? alpha(theme.palette.primary.main, 0.04)
														: alpha(theme.palette.primary.main, 0.08),
											},
											"& td": {
												borderBottom: `1px solid ${alpha(
													theme.palette.divider,
													0.9,
												)}`,
											},
										}}
									>
										<TableCell>
											<Stack direction="row" spacing={1.5} alignItems="center">
												<Button
													type="button"
													size="small"
													variant="text"
													onClick={() => openMemberEditor(row)}
													aria-label={`Edit member ${fullName}`}
													sx={{
														minWidth: 0,
														p: 0.75,
														borderRadius: 999,
														color: theme.palette.primary.main,
														"&:hover": {
															backgroundColor: alpha(
																theme.palette.primary.main,
																0.08,
															),
														},
													}}
												>
													<EditOutlinedIcon fontSize="small" />
												</Button>
												<Avatar
													src={row.avatar_url || undefined}
													alt={fullName}
													sx={{
														width: 44,
														height: 44,
														bgcolor:
															theme.palette.mode === "light"
																? alpha(theme.palette.text.primary, 0.06)
																: alpha(theme.palette.common.white, 0.08),
														color: theme.palette.text.primary,
														fontWeight: 700,
													}}
												>
													{getAdminMemberInitials(row)}
												</Avatar>
												<Box sx={{ minWidth: 0 }}>
													<Typography
														sx={{
															fontWeight: 700,
															lineHeight: 1.3,
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
														}}
													>
														{fullName}
													</Typography>
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap",
														}}
													>
														{row.email}
													</Typography>
												</Box>
											</Stack>
										</TableCell>

										<TableCell>{row.department || "Not set"}</TableCell>
										<TableCell>{row.member_role || "Member"}</TableCell>
										<TableCell>{row.phone || "Not provided"}</TableCell>
										<TableCell sx={{ fontFamily: "monospace" }}>
											{row.sepa?.iban || "Not provided"}
										</TableCell>
										<TableCell sx={{ fontFamily: "monospace" }}>
											{row.sepa?.bic || "Not provided"}
										</TableCell>
										<TableCell>
											{row.sepa?.bank_name || "Not provided"}
										</TableCell>
										<TableCell>
											<AgreementChip accepted={sepaAccepted} />
										</TableCell>
										<TableCell>
											<AgreementChip accepted={privacyAccepted} />
										</TableCell>
										<TableCell>
											<Chip
												size="small"
												label={getMemberStatusLabel(memberStatus)}
												color={
													memberStatus === "active" ? "success" : "default"
												}
												variant={
													memberStatus === "active" ? "filled" : "outlined"
												}
												sx={{
													fontWeight: 600,
													backgroundColor:
														memberStatus === "active"
															? alpha(theme.palette.success.main, 0.14)
															: alpha(theme.palette.text.secondary, 0.08),
													color:
														memberStatus === "active"
															? theme.palette.success.main
															: theme.palette.text.secondary,
													borderColor: alpha(
														theme.palette.text.secondary,
														0.18,
													),
												}}
											/>
										</TableCell>
									</TableRow>
								);
							})}

							{filtered.length === 0 && (
								<TableRow>
									<TableCell colSpan={sortableColumns.length}>
										<Box sx={{ py: 7, textAlign: "center" }}>
											<Typography sx={{ fontWeight: 700, mb: 1 }}>
												No members match the current filters
											</Typography>
											<Typography color="text.secondary">
												Try broadening the search or resetting the agreement
												filters.
											</Typography>
										</Box>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</TableContainer>
			</GlassCard>

			<Dialog
				open={Boolean(memberBeingEdited)}
				onClose={() => {
					if (!isSavingMember) {
						setMemberBeingEdited(null);
					}
				}}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Edit member</DialogTitle>
				<DialogContent>
					<Stack spacing={2} sx={{ pt: 1 }}>
						<Typography color="text.secondary">
							{memberBeingEdited
								? `Update ${memberBeingEdited.given_name} ${memberBeingEdited.surname}.`
								: ""}
						</Typography>
						<TextField
							select
							label="Department"
							value={editDepartment}
							onChange={(event) => setEditDepartment(event.target.value)}
							disabled={isBoardLeadershipRole(editRole)}
							helperText={
								isBoardLeadershipRole(editRole)
									? "President and Vice-President are always in Board."
									: undefined
							}
						>
							<MenuItem value="">None</MenuItem>
							{DEPARTMENTS.map((department) => (
								<MenuItem key={department} value={department}>
									{department}
								</MenuItem>
							))}
						</TextField>
						<TextField
							select
							label="Role"
							value={editRole}
							onChange={(event) => {
								const nextRole = event.target.value;
								setEditRole(nextRole);
								if (isBoardLeadershipRole(nextRole)) {
									setEditDepartment("Board");
								}
							}}
						>
							{MEMBER_ROLES.map((role) => (
								<MenuItem key={role} value={role}>
									{role}
								</MenuItem>
							))}
						</TextField>
						<TextField
							select
							label="Status"
							value={editStatus}
							onChange={(event) => setEditStatus(event.target.value)}
						>
							{MEMBER_STATUSES.map((status) => (
								<MenuItem key={status} value={status}>
									{getMemberStatusLabel(status)}
								</MenuItem>
							))}
						</TextField>
						<TextField
							select
							label="Access"
							value={editAccessRole}
							onChange={(event) =>
								setEditAccessRole(event.target.value as "user" | "admin")
							}
						>
							<MenuItem value="user">User</MenuItem>
							<MenuItem value="admin">Admin</MenuItem>
						</TextField>
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button
						type="button"
						variant="text"
						onClick={() => setMemberBeingEdited(null)}
						disabled={isSavingMember}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="contained"
						onClick={saveMemberChanges}
						disabled={isSavingMember}
					>
						{isSavingMember ? "Saving..." : "Save member changes"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}

interface MetricCardProps {
	icon: ReactNode;
	label: string;
	value: number;
}

function MetricCard({ icon, label, value }: MetricCardProps) {
	const theme = useTheme();

	return (
		<Box
			sx={{
				p: 2.25,
				borderRadius: 3,
				backgroundColor:
					theme.palette.mode === "light"
						? alpha(theme.palette.primary.main, 0.06)
						: alpha(theme.palette.primary.main, 0.12),
				border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
				display: "flex",
				alignItems: "center",
				gap: 1.5,
			}}
		>
			<Box
				sx={{
					width: 40,
					height: 40,
					borderRadius: 2.5,
					display: "grid",
					placeItems: "center",
					backgroundColor:
						theme.palette.mode === "light"
							? alpha(theme.palette.primary.main, 0.1)
							: alpha(theme.palette.common.white, 0.08),
					color: theme.palette.primary.main,
					flexShrink: 0,
				}}
			>
				{icon}
			</Box>
			<Box>
				<Typography variant="caption" color="text.secondary">
					{label}
				</Typography>
				<Typography variant="h5">{value}</Typography>
			</Box>
		</Box>
	);
}

function AgreementChip({ accepted }: { accepted: boolean }) {
	const theme = useTheme();

	return (
		<Chip
			size="small"
			label={accepted ? "Accepted" : "Not accepted"}
			variant={accepted ? "filled" : "outlined"}
			sx={{
				fontWeight: 600,
				backgroundColor: accepted
					? alpha(theme.palette.primary.main, 0.14)
					: alpha(theme.palette.warning.main, 0.12),
				color: accepted
					? theme.palette.primary.main
					: theme.palette.warning.main,
				borderColor: accepted
					? alpha(theme.palette.primary.main, 0.16)
					: alpha(theme.palette.warning.main, 0.22),
			}}
		/>
	);
}

function getSelectProps(
	options: ReadonlyArray<{ label: string; value: string }>,
): {
	displayEmpty: true;
	renderValue: (selected: unknown) => string;
} {
	return {
		displayEmpty: true,
		renderValue: (selected) =>
			options.find((option) => option.value === String(selected))?.label ??
			"All",
	};
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
