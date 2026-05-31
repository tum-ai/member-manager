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
	ToggleButton,
	ToggleButtonGroup,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactNode, useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
import { BOARD_MEMBER_ROLE } from "../../lib/constants";
import type { InnovationProject, Member, ResearchProject } from "../../types";
import { buildOrgChart } from "./orgChartUtils";

interface OrgChartViewProps {
	members: Member[];
	researchProjects?: ResearchProject[];
	innovationProjects?: InnovationProject[];
}

type OrgChartFocus = "departments" | "research";

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
}: {
	member: Member;
	highlight?: boolean;
	boardRole?: string;
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
	const explicitRole =
		typeof member.board_role === "string"
			? member.board_role.trim()
			: typeof member.boardRole === "string"
				? member.boardRole.trim()
				: "";
	if (explicitRole === BOARD_MEMBER_ROLE) return "Board member";

	return member.department === "Board" ? "Board member" : undefined;
}

function renderMembers(
	members: Member[],
	options: {
		showBoardBadge?: boolean;
		highlight?: boolean;
	} = {
		showBoardBadge: false,
	},
) {
	return members.map((member) => (
		<OrgChartPerson
			key={member.user_id}
			member={member}
			highlight={options.highlight}
			boardRole={
				options.showBoardBadge ? getBoardBadgeLabel(member) : undefined
			}
		/>
	));
}

function getMemberCountLabel(count: number): string {
	return `${count} member${count !== 1 ? "s" : ""}`;
}

function OrgChartTeamCard({
	title,
	count,
	description,
	badges,
	primaryLabel,
	primaryMembers,
	primaryEmpty,
	primaryHighlight = true,
	secondaryLabel,
	secondaryMembers,
	secondaryEmpty,
	showBoardBadge,
}: {
	title: string;
	count: number;
	description?: string;
	badges?: ReactNode;
	primaryLabel: string;
	primaryMembers: Member[];
	primaryEmpty: string;
	primaryHighlight?: boolean;
	secondaryLabel: string;
	secondaryMembers: Member[];
	secondaryEmpty: string;
	showBoardBadge?: boolean;
}) {
	const theme = useTheme();

	return (
		<Box
			sx={{
				height: "100%",
				borderRadius: 3,
				p: 2.5,
				backgroundColor:
					theme.palette.mode === "light"
						? "rgba(255, 255, 255, 0.68)"
						: "rgba(27, 0, 73, 0.28)",
				boxShadow:
					theme.palette.mode === "light"
						? "inset 0 1px 0 rgba(255, 255, 255, 0.86), 0 14px 34px rgba(15, 23, 42, 0.05)"
						: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
			}}
		>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					gap: 1.5,
					mb: 2,
				}}
			>
				<Box sx={{ minWidth: 0 }}>
					<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
						{title}
					</Typography>
					{description && (
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ mt: 0.75 }}
						>
							{description}
						</Typography>
					)}
					{badges && (
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
							{badges}
						</Box>
					)}
				</Box>
				<Chip
					label={getMemberCountLabel(count)}
					size="small"
					variant="outlined"
					sx={{ flexShrink: 0 }}
				/>
			</Box>

			<Typography
				variant="caption"
				color="text.secondary"
				sx={{ display: "block", mb: 1 }}
			>
				{primaryLabel}
			</Typography>
			<Box sx={{ display: "grid", gap: 1.25, mb: 2.25 }}>
				{primaryMembers.length > 0 ? (
					renderMembers(primaryMembers, {
						showBoardBadge,
						highlight: primaryHighlight,
					})
				) : (
					<Typography variant="body2" color="text.secondary">
						{primaryEmpty}
					</Typography>
				)}
			</Box>

			<Typography
				variant="caption"
				color="text.secondary"
				sx={{ display: "block", mb: 1 }}
			>
				{secondaryLabel}
			</Typography>
			<Box sx={{ display: "grid", gap: 1.25 }}>
				{secondaryMembers.length > 0 ? (
					renderMembers(secondaryMembers, { showBoardBadge })
				) : (
					<Typography variant="body2" color="text.secondary">
						{secondaryEmpty}
					</Typography>
				)}
			</Box>
		</Box>
	);
}

export default function OrgChartView({
	members,
	researchProjects = [],
	innovationProjects = [],
}: OrgChartViewProps): JSX.Element | null {
	const theme = useTheme();
	const [focus, setFocus] = useState<OrgChartFocus>("departments");
	const chart = buildOrgChart(members, researchProjects, innovationProjects);
	const boardMemberCount =
		chart.board.presidents.length +
		chart.board.vicePresidents.length +
		chart.board.members.length;
	const hasBoard = boardMemberCount > 0;
	const hasResearch = chart.researchProjects.length > 0;
	const hasInnovation = chart.innovationProjects.length > 0;
	const hasDepartments = chart.departments.length > 0;
	const canToggleTeams = hasDepartments && hasResearch;
	const activeFocus: OrgChartFocus = hasDepartments
		? hasResearch
			? focus
			: "departments"
		: "research";
	const showDepartments = hasDepartments && activeFocus === "departments";
	const showResearch = hasResearch && activeFocus === "research";

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
										})}
									</Stack>
								</Grid>
							)}
						</Grid>
					</>
				)}

				{(hasDepartments || hasResearch) && (
					<>
						<Divider sx={{ mb: 3 }} />
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: { xs: "stretch", sm: "center" },
								flexDirection: { xs: "column", sm: "row" },
								gap: 1.5,
								mb: 1.5,
							}}
						>
							<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
								Teams
							</Typography>
							{canToggleTeams && (
								<ToggleButtonGroup
									exclusive
									size="small"
									value={activeFocus}
									aria-label="Org chart section view"
									onChange={(_, nextFocus: OrgChartFocus | null) => {
										if (nextFocus) {
											setFocus(nextFocus);
										}
									}}
									sx={{
										width: { xs: "100%", sm: "auto" },
										alignSelf: { xs: "stretch", sm: "center" },
										p: 0.5,
										borderRadius: 2.5,
										backgroundColor:
											theme.palette.mode === "light"
												? "rgba(154, 100, 217, 0.08)"
												: "rgba(154, 100, 217, 0.14)",
										"& .MuiToggleButtonGroup-grouped": {
											flex: { xs: 1, sm: "0 0 auto" },
											gap: 0.75,
											px: { xs: 1, sm: 1.5 },
											border: 0,
											borderRadius: "10px !important",
											whiteSpace: "nowrap",
											color: "text.secondary",
											"&.Mui-selected": {
												backgroundColor:
													theme.palette.mode === "light"
														? "rgba(255, 255, 255, 0.92)"
														: "rgba(82, 53, 115, 0.56)",
												color: "text.primary",
												boxShadow:
													theme.palette.mode === "light"
														? "0 8px 20px rgba(15, 23, 42, 0.08)"
														: "none",
											},
										},
									}}
								>
									<ToggleButton value="departments">Departments</ToggleButton>
									<ToggleButton value="research">Research</ToggleButton>
								</ToggleButtonGroup>
							)}
						</Box>
						<Grid container spacing={2.5} alignItems="stretch">
							{showDepartments && (
								<Grid size={{ xs: 12, md: showResearch ? 6 : 12 }}>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											gap: 1.5,
											mb: 1.5,
										}}
									>
										<Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
											Departments
										</Typography>
										<Chip
											label={`${chart.departments.length} department${chart.departments.length !== 1 ? "s" : ""}`}
											size="small"
											variant="outlined"
										/>
									</Box>
									<Grid container spacing={2}>
										{chart.departments.map((group) => (
											<Grid
												key={group.department}
												size={{ xs: 12, md: showResearch ? 12 : 6 }}
											>
												<OrgChartTeamCard
													title={group.department}
													count={group.teamLeads.length + group.members.length}
													primaryLabel="Team Leads"
													primaryMembers={group.teamLeads}
													primaryEmpty="No team lead assigned yet."
													secondaryLabel="Members"
													secondaryMembers={group.members}
													secondaryEmpty="No active members in this department."
													showBoardBadge
												/>
											</Grid>
										))}
									</Grid>
								</Grid>
							)}

							{showResearch && (
								<Grid size={{ xs: 12, md: showDepartments ? 6 : 12 }}>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											gap: 1.5,
											mb: 1.5,
										}}
									>
										<Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
											Research Projects
										</Typography>
										<Chip
											label={`${chart.researchProjects.length} active project${chart.researchProjects.length !== 1 ? "s" : ""}`}
											size="small"
											variant="outlined"
										/>
									</Box>
									<Grid container spacing={2}>
										{chart.researchProjects.map((project) => (
											<Grid
												key={project.id}
												size={{ xs: 12, md: showDepartments ? 12 : 6 }}
											>
												<OrgChartTeamCard
													title={project.title}
													count={
														project.members.length +
														(project.leadSupervisor ? 1 : 0)
													}
													description={project.description}
													badges={
														project.status ? (
															<Chip
																label={project.status}
																size="small"
																color="primary"
																variant="outlined"
															/>
														) : undefined
													}
													primaryLabel="Lead Supervisor"
													primaryMembers={
														project.leadSupervisor
															? [project.leadSupervisor]
															: []
													}
													primaryEmpty="Not assigned in member manager yet."
													secondaryLabel="Project Members"
													secondaryMembers={project.members}
													secondaryEmpty="No project members assigned yet."
												/>
											</Grid>
										))}
									</Grid>
								</Grid>
							)}
						</Grid>
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
