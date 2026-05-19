import LinkedInIcon from "@mui/icons-material/LinkedIn";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SchoolIcon from "@mui/icons-material/School";
import SearchIcon from "@mui/icons-material/Search";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import {
	Avatar,
	Box,
	CardContent,
	Chip,
	CircularProgress,
	FormControl,
	Grid,
	IconButton,
	InputAdornment,
	InputLabel,
	MenuItem,
	Select,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { useInnovationProjects } from "../../hooks/useInnovationProjects";
import { useMembersListData } from "../../hooks/useMembersListData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import {
	BOARD_MEMBER_ROLE,
	DEGREE_TYPES,
	DEPARTMENTS,
	MEMBER_ROLES,
} from "../../lib/constants";
import {
	buildMemberNameSearchText,
	getEducationEntries,
	getMemberStatusLabel,
	getOperationalDepartment,
	splitDegree,
} from "../../lib/memberMetadata";
import type { Member } from "../../types";
import OrgChartView from "./OrgChartView";

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	const email = member.email?.charAt(0) || "";
	return (first + last || email).toUpperCase();
}

function getBoardBadgeLabel(member: Member): string | undefined {
	if (member.member_role === "President") return "President";
	if (member.member_role === "Vice-President") return "Vice-President";

	const explicitRole =
		typeof member.board_role === "string"
			? member.board_role.trim()
			: typeof member.boardRole === "string"
				? member.boardRole.trim()
				: "";
	if (explicitRole === BOARD_MEMBER_ROLE) return "Board member";

	return member.department === "Board" ? "Board member" : undefined;
}

function isBoardOnlyMember(member: Member): boolean {
	return (
		!getOperationalDepartment(member.department) &&
		(member.board_role === BOARD_MEMBER_ROLE || member.department === "Board")
	);
}

export default function MemberList() {
	const { members, isLoading, error } = useMembersListData();
	const { researchProjects } = useResearchProjects();
	const { innovationProjects } = useInnovationProjects();
	const [search, setSearch] = useState("");
	const [department, setDepartment] = useState("");
	const [role, setRole] = useState("");
	const [memberStatus, setMemberStatus] = useState("");
	const [degreeType, setDegreeType] = useState("");
	const [degreeProgram, setDegreeProgram] = useState("");

	const degreePrograms = useMemo(() => {
		if (!members) return [];
		return [
			...new Set(
				members.flatMap((member) =>
					getEducationEntries(member.degree, member.school).map(
						(entry) => splitDegree(entry.degree).program,
					),
				),
			),
		]
			.filter((program) => program !== "")
			.sort((left, right) => left.localeCompare(right));
	}, [members]);

	const filtered = useMemo(() => {
		if (!members) return [];
		const q = search.trim().toLowerCase();
		return members.filter((m) => {
			const educationEntries = getEducationEntries(m.degree, m.school);
			const degreeMetadata = educationEntries.map((entry) =>
				splitDegree(entry.degree),
			);
			const name = buildMemberNameSearchText(
				m.given_name,
				m.surname,
			).toLowerCase();
			const normalizedDepartment = getOperationalDepartment(m.department);
			const status = m.member_status || (m.active ? "active" : "inactive");
			const statusLabel = getMemberStatusLabel(status).toLowerCase();
			const dept = (normalizedDepartment || "").toLowerCase();
			const memberRole = (m.member_role || "").toLowerCase();
			const boardRole = (m.board_role || "").toLowerCase();
			const batch = (m.batch || "").toLowerCase();
			const degree = (m.degree || "").toLowerCase();
			const school = (m.school || "").toLowerCase();
			const location = (m.location || "").toLowerCase();
			const company = (m.current_company || "").toLowerCase();
			const education = (m.education || "").toLowerCase();
			if (
				q &&
				!(
					name.includes(q) ||
					dept.includes(q) ||
					memberRole.includes(q) ||
					boardRole.includes(q) ||
					batch.includes(q) ||
					degree.includes(q) ||
					school.includes(q) ||
					statusLabel.includes(q) ||
					location.includes(q) ||
					company.includes(q) ||
					education.includes(q)
				)
			) {
				return false;
			}
			if (department && normalizedDepartment !== department) return false;
			if (role && m.member_role !== role) return false;
			if (memberStatus && status !== memberStatus) return false;
			if (
				degreeType &&
				!degreeMetadata.some((entry) => entry.type === degreeType)
			) {
				return false;
			}
			if (
				degreeProgram &&
				!degreeMetadata.some((entry) => entry.program === degreeProgram)
			) {
				return false;
			}
			return true;
		});
	}, [
		members,
		search,
		department,
		role,
		memberStatus,
		degreeProgram,
		degreeType,
	]);

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "60vh",
					gap: 2,
				}}
			>
				<CircularProgress size={24} />
				<Typography color="text.secondary">Loading members...</Typography>
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ textAlign: "center", py: 8 }}>
				<Typography color="error">
					Failed to load members. Please try again later.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 2 }}>
			{filtered.length > 0 && (
				<OrgChartView
					members={filtered}
					researchProjects={researchProjects ?? []}
					innovationProjects={innovationProjects ?? []}
				/>
			)}

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
						<Box sx={{ maxWidth: 620 }}>
							<Typography variant="h3" sx={{ mb: 1.5 }}>
								All Members
							</Typography>
							<Typography variant="body1" color="text.secondary">
								Browse the TUM.ai member and alumni network and search across
								profiles.
							</Typography>
						</Box>

						<Box sx={{ width: "100%", maxWidth: 340 }}>
							<TextField
								size="small"
								placeholder="Search members..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								slotProps={{
									input: {
										startAdornment: (
											<InputAdornment position="start">
												<SearchIcon fontSize="small" />
											</InputAdornment>
										),
									},
								}}
								fullWidth
							/>
						</Box>
					</Box>

					<Box
						sx={{
							mt: 3,
							display: "flex",
							flexWrap: "wrap",
							gap: 2,
							alignItems: "center",
						}}
					>
						<FormControl size="small" sx={{ minWidth: 220 }}>
							<InputLabel id="member-list-department-label">
								Department
							</InputLabel>
							<Select
								labelId="member-list-department-label"
								value={department}
								label="Department"
								onChange={(e) => setDepartment(e.target.value)}
							>
								<MenuItem value="">All</MenuItem>
								{DEPARTMENTS.map((item) => (
									<MenuItem key={item} value={item}>
										{item}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<FormControl size="small" sx={{ minWidth: 220 }}>
							<InputLabel id="member-list-role-label">Role</InputLabel>
							<Select
								labelId="member-list-role-label"
								value={role}
								label="Role"
								onChange={(e) => setRole(e.target.value)}
							>
								<MenuItem value="">All</MenuItem>
								{MEMBER_ROLES.filter((item) => item !== "Alumni").map(
									(item) => (
										<MenuItem key={item} value={item}>
											{item}
										</MenuItem>
									),
								)}
							</Select>
						</FormControl>

						<FormControl size="small" sx={{ minWidth: 180 }}>
							<InputLabel id="member-list-status-label">Status</InputLabel>
							<Select
								labelId="member-list-status-label"
								value={memberStatus}
								label="Status"
								onChange={(e) => setMemberStatus(e.target.value)}
							>
								<MenuItem value="">All</MenuItem>
								<MenuItem value="active">Active</MenuItem>
								<MenuItem value="alumni">Alumni</MenuItem>
							</Select>
						</FormControl>

						<FormControl size="small" sx={{ minWidth: 220 }}>
							<InputLabel id="member-list-degree-label">Degree</InputLabel>
							<Select
								labelId="member-list-degree-label"
								value={degreeType}
								label="Degree"
								onChange={(e) => setDegreeType(e.target.value)}
							>
								<MenuItem value="">All</MenuItem>
								{DEGREE_TYPES.map((item) => (
									<MenuItem key={item} value={item}>
										{item}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<FormControl size="small" sx={{ minWidth: 240 }}>
							<InputLabel id="member-list-program-label">
								Major / Program
							</InputLabel>
							<Select
								labelId="member-list-program-label"
								value={degreeProgram}
								label="Major / Program"
								onChange={(e) => setDegreeProgram(e.target.value)}
							>
								<MenuItem value="">All</MenuItem>
								{degreePrograms.map((item) => (
									<MenuItem key={item} value={item}>
										{item}
									</MenuItem>
								))}
							</Select>
						</FormControl>

						<Typography variant="body2" color="text.secondary">
							{filtered.length} member profile
							{filtered.length !== 1 ? "s" : ""}
						</Typography>
					</Box>
				</CardContent>
			</GlassCard>

			{filtered.length === 0 ? (
				<GlassCard sx={{ textAlign: "center", py: 8 }}>
					<Typography color="text.secondary">
						{search ? "No members match your search." : "No members found."}
					</Typography>
				</GlassCard>
			) : (
				<Grid container spacing={2}>
					{filtered.map((member) => (
						<Grid key={member.user_id} size={{ xs: 12, sm: 6, md: 4 }}>
							<MemberCard member={member} />
						</Grid>
					))}
				</Grid>
			)}
		</Box>
	);
}

interface MemberCardProps {
	member: Member;
}

function MemberCard({ member }: MemberCardProps) {
	const theme = useTheme();
	const fullName = `${member.given_name} ${member.surname}`.trim();
	const displayName = fullName || member.email || "Unnamed Member";
	const operationalDepartment = getOperationalDepartment(member.department);
	const boardBadgeLabel = getBoardBadgeLabel(member);
	const status =
		member.member_status || (member.active ? "active" : "inactive");
	const educationEntries = getEducationEntries(member.degree, member.school);
	const showMemberRole = Boolean(
		member.member_role && !isBoardOnlyMember(member),
	);

	return (
		<GlassCard variant="interactive">
			<CardContent sx={{ p: 2.5 }}>
				<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
					<Avatar
						src={member.avatar_url || undefined}
						alt={displayName}
						sx={{
							width: 56,
							height: 56,
							bgcolor:
								theme.palette.mode === "light"
									? alpha(theme.palette.text.primary, 0.06)
									: alpha(theme.palette.common.white, 0.08),
							color: theme.palette.text.primary,
							fontSize: 18,
							fontWeight: 700,
							flexShrink: 0,
							boxShadow: "none",
						}}
					>
						{getInitials(member)}
					</Avatar>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: 700,
								lineHeight: 1.3,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{displayName}
						</Typography>

						{showMemberRole && (
							<Typography
								variant="body2"
								color="primary"
								sx={{ lineHeight: 1.4 }}
							>
								{member.member_role}
							</Typography>
						)}

						{operationalDepartment && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ lineHeight: 1.4 }}
							>
								{operationalDepartment}
							</Typography>
						)}
					</Box>
					{member.linkedin_url && (
						<Tooltip title="Connect on LinkedIn" arrow>
							<IconButton
								href={member.linkedin_url}
								target="_blank"
								rel="noopener noreferrer"
								size="small"
								sx={{
									color: "#0A66C2",
									alignSelf: "flex-start",
									mt: -0.5,
									mr: -0.5,
									"&:hover": {
										backgroundColor: alpha("#0A66C2", 0.08),
									},
								}}
							>
								<LinkedInIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					)}
				</Box>

				<Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
					{status !== "active" && (
						<Chip
							label={getMemberStatusLabel(status)}
							size="small"
							variant="outlined"
						/>
					)}
					{boardBadgeLabel && (
						<Chip label={boardBadgeLabel} size="small" variant="outlined" />
					)}
					{member.batch && (
						<Chip label={member.batch} size="small" variant="outlined" />
					)}
					{educationEntries.map((entry, index) => (
						<Chip
							key={`${entry.degree}-${entry.school}-${index}`}
							label={[entry.degree, entry.school].filter(Boolean).join(" · ")}
							size="small"
							variant="outlined"
							sx={{
								maxWidth: "100%",
								"& .MuiChip-label": {
									overflow: "hidden",
									textOverflow: "ellipsis",
								},
							}}
						/>
					))}
				</Box>

				{(member.current_company || member.location || member.education) && (
					<Box
						sx={{
							mt: 2,
							pt: 1.5,
							borderTop: `1px solid ${
								theme.palette.mode === "light"
									? alpha(theme.palette.text.primary, 0.06)
									: alpha(theme.palette.common.white, 0.08)
							}`,
							display: "flex",
							flexDirection: "column",
							gap: 0.75,
						}}
					>
						{member.current_company && (
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<WorkOutlineIcon
									sx={{
										fontSize: 16,
										color: theme.palette.text.secondary,
										opacity: 0.75,
									}}
								/>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{
										fontSize: "0.825rem",
										fontWeight: 500,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{member.current_company}
								</Typography>
							</Box>
						)}
						{member.location && (
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<LocationOnIcon
									sx={{
										fontSize: 16,
										color: theme.palette.text.secondary,
										opacity: 0.75,
									}}
								/>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{
										fontSize: "0.825rem",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{member.location}
								</Typography>
							</Box>
						)}
						{member.education && (
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<SchoolIcon
									sx={{
										fontSize: 16,
										color: theme.palette.text.secondary,
										opacity: 0.75,
									}}
								/>
								<Typography
									variant="body2"
									color="text.secondary"
									sx={{
										fontSize: "0.825rem",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{member.education}
								</Typography>
							</Box>
						)}
					</Box>
				)}
			</CardContent>
		</GlassCard>
	);
}
