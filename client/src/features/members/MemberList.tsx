import SearchIcon from "@mui/icons-material/Search";
import {
	Avatar,
	Box,
	CardContent,
	Chip,
	CircularProgress,
	FormControl,
	Grid,
	InputAdornment,
	InputLabel,
	MenuItem,
	Select,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { useInnovationProjects } from "../../hooks/useInnovationProjects";
import { useMembersListData } from "../../hooks/useMembersListData";
import { useResearchProjects } from "../../hooks/useResearchProjects";
import { DEGREE_TYPES, DEPARTMENTS, MEMBER_ROLES } from "../../lib/constants";
import { splitDegree } from "../../lib/memberMetadata";
import type { Member } from "../../types";
import OrgChartView from "./OrgChartView";

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
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
	if (explicitRole) return explicitRole;

	return member.department === "Board" ? "Board Member" : undefined;
}

function isBoardOnlyMember(member: Member): boolean {
	return member.department === "Board";
}

export default function MemberList() {
	const { members, isLoading, error } = useMembersListData();
	const { researchProjects } = useResearchProjects();
	const { innovationProjects } = useInnovationProjects();
	const [search, setSearch] = useState("");
	const [department, setDepartment] = useState("");
	const [role, setRole] = useState("");
	const [degreeType, setDegreeType] = useState("");
	const [degreeProgram, setDegreeProgram] = useState("");

	const degreePrograms = useMemo(() => {
		if (!members) return [];
		return [
			...new Set(
				members.map((member) => splitDegree(member.degree || "").program),
			),
		]
			.filter((program) => program !== "")
			.sort((left, right) => left.localeCompare(right));
	}, [members]);

	const filtered = useMemo(() => {
		if (!members) return [];
		const q = search.trim().toLowerCase();
		return members.filter((m) => {
			const { type, program } = splitDegree(m.degree || "");
			const name = `${m.given_name} ${m.surname}`.toLowerCase();
			const dept = (m.department || "").toLowerCase();
			const memberRole = (m.member_role || "").toLowerCase();
			const batch = (m.batch || "").toLowerCase();
			const degree = (m.degree || "").toLowerCase();
			const school = (m.school || "").toLowerCase();
			if (
				q &&
				!(
					name.includes(q) ||
					dept.includes(q) ||
					memberRole.includes(q) ||
					batch.includes(q) ||
					degree.includes(q) ||
					school.includes(q)
				)
			) {
				return false;
			}
			if (department && m.department !== department) return false;
			if (role && m.member_role !== role) return false;
			if (degreeType && type !== degreeType) return false;
			if (degreeProgram && program !== degreeProgram) return false;
			return true;
		});
	}, [members, search, department, role, degreeProgram, degreeType]);

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
								Browse the active network and search across current member
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
							{filtered.length} active member
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
	const boardBadgeLabel = getBoardBadgeLabel(member);
	const showMemberRole = Boolean(
		member.member_role && !isBoardOnlyMember(member),
	);
	const showDepartment = Boolean(
		member.department && member.department !== "Board",
	);

	return (
		<GlassCard variant="interactive">
			<CardContent sx={{ p: 2.5 }}>
				<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
					<Avatar
						src={member.avatar_url || undefined}
						alt={`${member.given_name} ${member.surname}`.trim() || undefined}
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
							{fullName || "Unnamed Member"}
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

						{showDepartment && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ lineHeight: 1.4 }}
							>
								{member.department}
							</Typography>
						)}
					</Box>
				</Box>

				<Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
					{boardBadgeLabel && (
						<Chip label={boardBadgeLabel} size="small" variant="outlined" />
					)}
					{member.batch && (
						<Chip label={member.batch} size="small" variant="outlined" />
					)}
					{member.degree && (
						<Chip label={member.degree} size="small" variant="outlined" />
					)}
					{member.school && (
						<Chip
							label={member.school}
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
					)}
				</Box>
			</CardContent>
		</GlassCard>
	);
}
