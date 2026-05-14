import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import {
	Box,
	Button,
	CardContent,
	Chip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { getOperationalDepartment } from "../../lib/memberMetadata";
import type { Member } from "../../types";
import CommunityConstellationPanel from "./CommunityConstellationPanel";
import CommunityGraphCanvas from "./CommunityGraphCanvas";
import { buildMemberGraph, getMemberTags } from "./communityGraphUtils";

interface CommunityConstellationProps {
	members: Member[];
	selectedMemberId: string;
	search: string;
	onSearchChange: (value: string) => void;
	onSelectedMemberChange: (memberId: string) => void;
	onDepartmentSelect: (department: string) => void;
}

export default function CommunityConstellation({
	members,
	selectedMemberId,
	search,
	onSearchChange,
	onSelectedMemberChange,
	onDepartmentSelect,
}: CommunityConstellationProps) {
	const theme = useTheme();
	const graph = useMemo(
		() => buildMemberGraph(members, selectedMemberId, search),
		[members, selectedMemberId, search],
	);

	if (!graph) return null;

	const department = getOperationalDepartment(graph.selectedMember.department);
	const memberTags = getMemberTags(graph.selectedMember);
	const selectedIndex = members.findIndex(
		(member) => member.user_id === graph.selectedMember.user_id,
	);
	const focusNextMember = () => {
		if (members.length === 0) return;
		const nextIndex = selectedIndex >= 0 ? selectedIndex + 1 : 0;
		onSelectedMemberChange(members[nextIndex % members.length].user_id);
	};

	return (
		<GlassCard
			variant="elevated"
			sx={{
				mb: 4,
				overflow: "hidden",
				position: "relative",
				background:
					theme.palette.mode === "light"
						? "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(245,239,255,0.88) 48%, rgba(255,255,255,0.98) 100%)"
						: "linear-gradient(135deg, rgba(13,2,20,0.96) 0%, rgba(27,0,73,0.92) 58%, rgba(82,53,115,0.58) 100%)",
				"&::before": {
					content: '""',
					position: "absolute",
					inset: 0,
					backgroundImage:
						"radial-gradient(circle at 18% 22%, rgba(154,100,217,0.22), transparent 24%), radial-gradient(circle at 82% 18%, rgba(82,53,115,0.18), transparent 21%), radial-gradient(circle at 72% 86%, rgba(154,100,217,0.16), transparent 24%)",
					pointerEvents: "none",
				},
			}}
		>
			<CardContent sx={{ p: { xs: 2.5, md: 3.5 }, position: "relative" }}>
				<GraphHeader
					membersCount={members.length}
					visibleCount={graph.visibleCount}
					onDiscoverNext={focusNextMember}
				/>

				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 340px" },
						gap: 2.5,
						alignItems: "stretch",
					}}
				>
					<CommunityGraphCanvas
						columns={graph.columns}
						paths={graph.paths}
						matchesCount={graph.matches.length}
						search={search}
						onSearchChange={onSearchChange}
						onDepartmentSelect={onDepartmentSelect}
						onSelectedMemberChange={onSelectedMemberChange}
					/>

					<CommunityConstellationPanel
						selectedMember={graph.selectedMember}
						matches={graph.matches}
						relatedMembers={graph.relatedMembers}
						memberTags={memberTags}
						department={department}
						query={search}
						visibleCount={graph.visibleCount}
						totalCount={members.length}
						onDepartmentSelect={onDepartmentSelect}
						onSelectedMemberChange={onSelectedMemberChange}
					/>
				</Box>
			</CardContent>
		</GlassCard>
	);
}

function GraphHeader({
	membersCount,
	visibleCount,
	onDiscoverNext,
}: {
	membersCount: number;
	visibleCount: number;
	onDiscoverNext: () => void;
}) {
	const theme = useTheme();
	return (
		<Box
			sx={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: { xs: "flex-start", md: "center" },
				gap: 2,
				flexDirection: { xs: "column", md: "row" },
				mb: 2.5,
			}}
		>
			<Box sx={{ maxWidth: 760 }}>
				<Chip
					icon={<AutoAwesomeIcon />}
					label="Member graph"
					size="small"
					sx={{
						mb: 1.25,
						bgcolor: alpha(theme.palette.primary.main, 0.12),
						color: theme.palette.primary.main,
						fontWeight: 800,
					}}
				/>
				<Typography variant="h5" sx={{ mb: 0.75 }}>
					Search, then follow the connections.
				</Typography>
				<Typography variant="body2" color="text.secondary">
					A focused map of members, departments, programs and cohorts — built
					for quick discovery, not decoration.
				</Typography>
			</Box>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
				<Chip
					label={`${visibleCount}/${membersCount} visible`}
					size="small"
					variant="outlined"
				/>
				<Button
					variant="contained"
					startIcon={<ShuffleIcon />}
					onClick={onDiscoverNext}
					disabled={membersCount < 2}
				>
					Discover next
				</Button>
			</Box>
		</Box>
	);
}
