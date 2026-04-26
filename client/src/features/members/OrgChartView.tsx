import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Avatar,
	Box,
	CardContent,
	Chip,
	Divider,
	Grid,
	Stack,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import GlassCard from "../../components/ui/GlassCard";
import type { InnovationProject, Member, ResearchProject } from "../../types";
import { buildOrgChart } from "./orgChartUtils";

interface OrgChartViewProps {
	members: Member[];
	researchProjects?: ResearchProject[];
	innovationProjects?: InnovationProject[];
}

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
}

function getDisplayName(member: Member): string {
	return `${member.given_name} ${member.surname}`.trim() || "Unnamed Member";
}

function OrgChartPerson({
	member,
	highlight,
	boardRole,
	showMemberRole = true,
}: {
	member: Member;
	highlight?: boolean;
	boardRole?: string;
	showMemberRole?: boolean;
}) {
	const theme = useTheme();

	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1.5,
				p: 1.5,
				borderRadius: 2.5,
				backgroundColor: highlight
					? theme.palette.mode === "light"
						? "rgba(154, 100, 217, 0.08)"
						: "rgba(27, 0, 73, 0.42)"
					: theme.palette.mode === "light"
						? "rgba(154, 100, 217, 0.04)"
						: "rgba(24, 17, 47, 0.72)",
			}}
		>
			<Avatar
				src={member.avatar_url || undefined}
				alt={getDisplayName(member)}
				sx={{
					width: highlight ? 48 : 40,
					height: highlight ? 48 : 40,
					bgcolor:
						theme.palette.mode === "light"
							? alpha(theme.palette.text.primary, 0.06)
							: alpha(theme.palette.common.white, 0.08),
					color: theme.palette.text.primary,
					fontWeight: 700,
				}}
			>
				{getInitials(member)}
			</Avatar>
			<Box sx={{ minWidth: 0 }}>
				<Typography sx={{ fontWeight: 700 }}>
					{getDisplayName(member)}
				</Typography>
				{showMemberRole && member.member_role && (
					<Typography variant="body2" color="primary">
						{member.member_role}
					</Typography>
				)}
				{boardRole && (
					<Chip
						label={boardRole}
						size="small"
						sx={{
							mt: 0.75,
							height: 22,
							backgroundColor:
								theme.palette.mode === "light"
									? "rgba(154, 100, 217, 0.12)"
									: "rgba(154, 100, 217, 0.22)",
							color: theme.palette.text.primary,
							fontWeight: 700,
						}}
					/>
				)}
			</Box>
		</Box>
	);
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

	return member.department === "Board" ? "Board" : undefined;
}

function renderMembers(
	members: Member[],
	options: {
		showBoardBadge?: boolean;
		highlight?: boolean;
		showMemberRole?: boolean;
	} = {
		showBoardBadge: false,
		showMemberRole: true,
	},
) {
	return members.map((member) => (
		<OrgChartPerson
			key={member.user_id}
			member={member}
			highlight={options.highlight}
			showMemberRole={options.showMemberRole}
			boardRole={
				options.showBoardBadge ? getBoardBadgeLabel(member) : undefined
			}
		/>
	));
}

export default function OrgChartView({
	members,
	researchProjects = [],
	innovationProjects = [],
}: OrgChartViewProps): JSX.Element | null {
	const chart = buildOrgChart(members, researchProjects, innovationProjects);
	const boardMemberCount =
		chart.board.presidents.length +
		chart.board.vicePresidents.length +
		chart.board.members.length;
	const hasBoard = boardMemberCount > 0;
	const hasResearch = chart.researchProjects.length > 0;
	const hasInnovation = chart.innovationProjects.length > 0;
	const hasDepartments = chart.departments.length > 0;

	if (!hasBoard && !hasResearch && !hasInnovation && !hasDepartments) {
		return null;
	}

	return (
		<GlassCard variant="elevated" sx={{ mb: 3, overflow: "hidden" }}>
			<CardContent sx={{ p: { xs: 3, md: 4 } }}>
				<Box sx={{ mb: 3 }}>
					<Typography variant="h5" sx={{ mb: 1 }}>
						Org Chart
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Overview of current leadership, departments and research.
					</Typography>
				</Box>

				{hasBoard && (
					<>
						<Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
							Board
						</Typography>
						<Grid container spacing={1.5} sx={{ mb: 3 }}>
							{chart.board.presidents.length > 0 && (
								<Grid size={{ xs: 12, md: 4 }}>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ display: "block", mb: 1 }}
									>
										President
									</Typography>
									<Stack spacing={1.25}>
										{renderMembers(chart.board.presidents, {
											highlight: true,
											showMemberRole: false,
										})}
									</Stack>
								</Grid>
							)}
							{chart.board.vicePresidents.length > 0 && (
								<Grid size={{ xs: 12, md: 4 }}>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ display: "block", mb: 1 }}
									>
										Vice President
									</Typography>
									<Stack spacing={1.25}>
										{renderMembers(chart.board.vicePresidents, {
											highlight: true,
											showMemberRole: false,
										})}
									</Stack>
								</Grid>
							)}
							{chart.board.members.length > 0 && (
								<Grid size={{ xs: 12, md: 4 }}>
									<Typography
										variant="caption"
										color="text.secondary"
										sx={{ display: "block", mb: 1 }}
									>
										Board Members
									</Typography>
									<Stack spacing={1.25}>
										{renderMembers(chart.board.members, {
											highlight: true,
											showMemberRole: false,
										})}
									</Stack>
								</Grid>
							)}
						</Grid>
					</>
				)}

				{hasDepartments && (
					<>
						<Divider sx={{ mb: 3 }} />
						<Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
							Departments
						</Typography>
						<Grid container spacing={2}>
							{chart.departments.map((group) => (
								<Grid key={group.department} size={{ xs: 12, md: 6 }}>
									<GlassCard
										sx={{
											height: "100%",
											backgroundColor: "transparent",
										}}
									>
										<CardContent sx={{ p: 2.5 }}>
											<Box
												sx={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													gap: 1.5,
													mb: 2,
												}}
											>
												<Typography
													variant="subtitle1"
													sx={{ fontWeight: 700 }}
												>
													{group.department}
												</Typography>
												<Chip
													label={`${group.teamLeads.length + group.members.length} member${group.teamLeads.length + group.members.length !== 1 ? "s" : ""}`}
													size="small"
													variant="outlined"
												/>
											</Box>

											<Typography
												variant="caption"
												color="text.secondary"
												sx={{ display: "block", mb: 1 }}
											>
												Team Leads
											</Typography>
											<Box sx={{ display: "grid", gap: 1.25, mb: 2.25 }}>
												{group.teamLeads.length > 0 ? (
													renderMembers(group.teamLeads, {
														showBoardBadge: true,
													})
												) : (
													<Typography variant="body2" color="text.secondary">
														No team lead assigned yet.
													</Typography>
												)}
											</Box>

											<Typography
												variant="caption"
												color="text.secondary"
												sx={{ display: "block", mb: 1 }}
											>
												Members
											</Typography>
											<Box sx={{ display: "grid", gap: 1.25 }}>
												{group.members.length > 0 ? (
													renderMembers(group.members, {
														showBoardBadge: true,
													})
												) : (
													<Typography variant="body2" color="text.secondary">
														No active members in this department.
													</Typography>
												)}
											</Box>
										</CardContent>
									</GlassCard>
								</Grid>
							))}
						</Grid>
					</>
				)}

				{hasResearch && (
					<>
						<Divider sx={{ my: 3 }} />
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								gap: 1.5,
								mb: 1.5,
							}}
						>
							<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
								Research Projects
							</Typography>
							<Chip
								label={`${chart.researchProjects.length} active project${chart.researchProjects.length !== 1 ? "s" : ""}`}
								size="small"
								variant="outlined"
							/>
						</Box>
						<Stack spacing={1.5}>
							{chart.researchProjects.map((project) => (
								<Accordion
									key={project.id}
									disableGutters
									slotProps={{ transition: { unmountOnExit: true } }}
									sx={{
										backgroundColor: "transparent",
										borderRadius: 2.5,
										boxShadow: "none",
										"&:before": { display: "none" },
									}}
								>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Box
											sx={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												gap: 1.5,
												width: "100%",
												pr: 1,
											}}
										>
											<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
												{project.title}
											</Typography>
											{project.status && (
												<Chip
													label={project.status}
													size="small"
													color="primary"
													variant="outlined"
												/>
											)}
										</Box>
									</AccordionSummary>
									<AccordionDetails sx={{ pt: 0, px: 2.5, pb: 2.5 }}>
										{project.description && (
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{ mb: 2 }}
											>
												{project.description}
											</Typography>
										)}

										<Typography
											variant="caption"
											color="text.secondary"
											sx={{ display: "block", mb: 1 }}
										>
											Lead Supervisor
										</Typography>
										<Box sx={{ display: "grid", gap: 1.25, mb: 2.25 }}>
											{project.leadSupervisor ? (
												<OrgChartPerson
													member={project.leadSupervisor}
													highlight
												/>
											) : (
												<Typography variant="body2" color="text.secondary">
													Not assigned in member manager yet.
												</Typography>
											)}
										</Box>

										<Typography
											variant="caption"
											color="text.secondary"
											sx={{ display: "block", mb: 1 }}
										>
											Project Members
										</Typography>
										<Box sx={{ display: "grid", gap: 1.25 }}>
											{project.members.length > 0 ? (
												renderMembers(project.members)
											) : (
												<Typography variant="body2" color="text.secondary">
													No project members assigned yet.
												</Typography>
											)}
										</Box>
									</AccordionDetails>
								</Accordion>
							))}
						</Stack>
					</>
				)}

				{hasInnovation && (
					<>
						<Divider sx={{ my: 3 }} />
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								gap: 1.5,
								mb: 1.5,
							}}
						>
							<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
								Innovation Projects
							</Typography>
							<Chip
								label={`${chart.innovationProjects.length} active project${chart.innovationProjects.length !== 1 ? "s" : ""}`}
								size="small"
								variant="outlined"
							/>
						</Box>
						<Stack spacing={1.5}>
							{chart.innovationProjects.map((project) => (
								<Accordion
									key={project.id}
									disableGutters
									slotProps={{ transition: { unmountOnExit: true } }}
									sx={{
										backgroundColor: "transparent",
										borderRadius: 2.5,
										boxShadow: "none",
										"&:before": { display: "none" },
									}}
								>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Box sx={{ pr: 1 }}>
											<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
												{project.title}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												{project.description}
											</Typography>
										</Box>
									</AccordionSummary>
									<AccordionDetails sx={{ pt: 0, px: 2.5, pb: 2.5 }}>
										{project.detailedDescription && (
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{ mb: 2 }}
											>
												{project.detailedDescription}
											</Typography>
										)}

										<Typography
											variant="caption"
											color="text.secondary"
											sx={{ display: "block", mb: 1 }}
										>
											Project Leads
										</Typography>
										<Box sx={{ display: "grid", gap: 1.25, mb: 2.25 }}>
											{project.leads.length > 0 ? (
												renderMembers(project.leads, { highlight: true })
											) : (
												<Typography variant="body2" color="text.secondary">
													No project lead assigned yet.
												</Typography>
											)}
										</Box>

										<Typography
											variant="caption"
											color="text.secondary"
											sx={{ display: "block", mb: 1 }}
										>
											Project Members
										</Typography>
										<Box sx={{ display: "grid", gap: 1.25 }}>
											{project.members.length > 0 ? (
												renderMembers(project.members)
											) : (
												<Typography variant="body2" color="text.secondary">
													No project members assigned yet.
												</Typography>
											)}
										</Box>
									</AccordionDetails>
								</Accordion>
							))}
						</Stack>
					</>
				)}
			</CardContent>
		</GlassCard>
	);
}
