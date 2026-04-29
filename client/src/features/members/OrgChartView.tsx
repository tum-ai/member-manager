import {
	Avatar,
	Box,
	CardContent,
	Chip,
	Divider,
	Grid,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import GlassCard from "../../components/ui/GlassCard";
import { BOARD_MEMBER_ROLE } from "../../lib/constants";
import type { Member } from "../../types";
import { buildOrgChart } from "./orgChartUtils";

interface OrgChartViewProps {
	members: Member[];
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
	hideRole,
}: {
	member: Member;
	highlight?: boolean;
	hideRole?: boolean;
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
				{member.member_role && !hideRole && (
					<Typography variant="body2" color="primary">
						{member.member_role}
					</Typography>
				)}
				{member.board_role === BOARD_MEMBER_ROLE && !hideRole && (
					<Chip
						label="Board"
						size="small"
						variant="outlined"
						sx={{ mt: 0.5 }}
					/>
				)}
			</Box>
		</Box>
	);
}

export default function OrgChartView({
	members,
}: OrgChartViewProps): JSX.Element | null {
	const chart = buildOrgChart(members);

	if (
		chart.executives.length === 0 &&
		chart.boardMembers.length === 0 &&
		chart.departments.length === 0
	) {
		return null;
	}

	return (
		<GlassCard variant="elevated" sx={{ mb: 3, overflow: "hidden" }}>
			<CardContent sx={{ p: { xs: 3, md: 4 } }}>
				<Typography variant="h5" sx={{ mb: 1 }}>
					Org Chart
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
					A simple view of current leadership and department structure.
				</Typography>

				{(chart.executives.length > 0 || chart.boardMembers.length > 0) && (
					<>
						<Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
							Board
						</Typography>
						<Grid container spacing={1.5} sx={{ mb: 3 }}>
							{chart.executives.map((member) => (
								<Grid key={member.user_id} size={{ xs: 12, sm: 6 }}>
									<OrgChartPerson member={member} highlight />
								</Grid>
							))}
							{chart.boardMembers.map((member) => (
								<Grid key={member.user_id} size={{ xs: 12, sm: 6 }}>
									<OrgChartPerson member={member} hideRole />
								</Grid>
							))}
						</Grid>
					</>
				)}

				<Divider sx={{ mb: 3 }} />

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
										<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
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
											group.teamLeads.map((member) => (
												<OrgChartPerson key={member.user_id} member={member} />
											))
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
											group.members.map((member) => (
												<OrgChartPerson key={member.user_id} member={member} />
											))
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
			</CardContent>
		</GlassCard>
	);
}
