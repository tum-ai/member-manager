import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
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
	const { members, isLoading, error, toggleStatus, isToggling } =
		useAdminData();

	const [filters, setFilters] = useState<AdminFilters>(initialFilters);
	const [sortBy, setSortBy] = useState<AdminSortKey>("surname");
	const [sortAsc, setSortAsc] = useState(true);
	const [memberPendingToggle, setMemberPendingToggle] =
		useState<AdminMember | null>(null);
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

	async function confirmToggleStatus() {
		if (!memberPendingToggle) return;
		try {
			await toggleStatus({
				userId: memberPendingToggle.user_id,
				newStatus: !memberPendingToggle.active,
			});
			showToast("Status updated successfully", "success");
			setMemberPendingToggle(null);
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			showToast(`Failed to update status: ${errorMessage}`, "error");
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
			Status: member.active ? "Active" : "Alumni",
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
								label="Member status"
								value={filters.active}
								onChange={(event) =>
									setFilters((currentValue) => ({
										...currentValue,
										active: event.target.value,
									}))
								}
								slotProps={{
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

			<GlassCard variant="elevated" sx={{ overflow: "hidden" }}>
				<TableContainer sx={{ maxHeight: "72vh" }}>
					<Table stickyHeader size="small" sx={{ minWidth: 1480 }}>
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
								<TableCell
									sx={{
										minWidth: 140,
										backgroundColor:
											theme.palette.mode === "light"
												? alpha(theme.palette.background.paper, 0.98)
												: alpha(theme.palette.background.paper, 0.94),
										borderBottom: `1px solid ${theme.palette.divider}`,
									}}
								>
									Actions
								</TableCell>
							</TableRow>
						</TableHead>

						<TableBody>
							{filtered.map((row) => {
								const sepaAccepted = hasMandateAgreement(row);
								const privacyAccepted = hasPrivacyAgreement(row);
								const fullName =
									`${row.given_name} ${row.surname}`.trim() || "Unnamed member";

								return (
									<TableRow
										key={row.user_id}
										hover
										sx={{
											opacity: row.active ? 1 : 0.84,
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
												label={row.active ? "Active" : "Alumni"}
												color={row.active ? "success" : "default"}
												variant={row.active ? "filled" : "outlined"}
												sx={{
													fontWeight: 600,
													backgroundColor: row.active
														? alpha(theme.palette.success.main, 0.14)
														: alpha(theme.palette.text.secondary, 0.08),
													color: row.active
														? theme.palette.success.main
														: theme.palette.text.secondary,
													borderColor: alpha(
														theme.palette.text.secondary,
														0.18,
													),
												}}
											/>
										</TableCell>
										<TableCell>
											<Button
												type="button"
												size="small"
												variant="outlined"
												startIcon={<SwapHorizOutlinedIcon />}
												onClick={() => setMemberPendingToggle(row)}
											>
												{row.active ? "Set Alumni" : "Set active"}
											</Button>
										</TableCell>
									</TableRow>
								);
							})}

							{filtered.length === 0 && (
								<TableRow>
									<TableCell colSpan={sortableColumns.length + 1}>
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
				open={Boolean(memberPendingToggle)}
				onClose={() => {
					if (!isToggling) {
						setMemberPendingToggle(null);
					}
				}}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Update member status</DialogTitle>
				<DialogContent>
					<Typography color="text.secondary">
						{memberPendingToggle
							? `Set ${memberPendingToggle.given_name} ${memberPendingToggle.surname} to ${memberPendingToggle.active ? "Alumni" : "active"}?`
							: ""}
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						type="button"
						variant="text"
						onClick={() => setMemberPendingToggle(null)}
						disabled={isToggling}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="contained"
						onClick={confirmToggleStatus}
						disabled={isToggling}
					>
						{isToggling ? "Saving..." : "Confirm"}
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
