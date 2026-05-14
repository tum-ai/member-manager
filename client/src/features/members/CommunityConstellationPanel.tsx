import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import {
	Avatar,
	Box,
	Button,
	ButtonBase,
	CardContent,
	Chip,
	Stack,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import GlassCard from "../../components/ui/GlassCard";
import type { Member } from "../../types";
import {
	getDisplayName,
	getInitials,
	type RelatedMember,
} from "./communityGraphUtils";

interface CommunityConstellationPanelProps {
	selectedMember: Member;
	matches: Member[];
	relatedMembers: RelatedMember[];
	memberTags: string[];
	department: string | null;
	query: string;
	visibleCount: number;
	totalCount: number;
	onDepartmentSelect: (department: string) => void;
	onSelectedMemberChange: (memberId: string) => void;
}

export default function CommunityConstellationPanel({
	selectedMember,
	matches,
	relatedMembers,
	memberTags,
	department,
	query,
	visibleCount,
	totalCount,
	onDepartmentSelect,
	onSelectedMemberChange,
}: CommunityConstellationPanelProps) {
	const theme = useTheme();
	const shownPeople = query.trim()
		? matches
				.slice(0, 7)
				.map((member) => ({ member, reasons: ["Search match"] }))
		: relatedMembers.slice(0, 7).map((item) => item);

	return (
		<GlassCard
			sx={{
				height: "100%",
				backgroundColor: alpha(
					theme.palette.background.paper,
					theme.palette.mode === "light" ? 0.78 : 0.56,
				),
				boxShadow: "none",
			}}
		>
			<CardContent sx={{ p: 2.5 }}>
				<Stack spacing={2.1}>
					<Box>
						<Chip
							icon={<PersonSearchIcon />}
							label={query.trim() ? "Search results" : "Selected member"}
							size="small"
							variant="outlined"
							sx={{ mb: 1.5, fontWeight: 700 }}
						/>
						<Typography variant="h4" sx={{ mb: 0.75 }}>
							{query.trim()
								? `${matches.length} match${matches.length === 1 ? "" : "es"}`
								: getDisplayName(selectedMember)}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							{query.trim()
								? `Showing ${visibleCount} of ${totalCount} people in the current graph.`
								: memberTags.slice(0, 2).join(" · ") ||
									"Active community member"}
						</Typography>
					</Box>

					{!query.trim() && (
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
							{memberTags.map((tag) => (
								<Chip key={tag} label={tag} size="small" variant="outlined" />
							))}
						</Box>
					)}

					{department && !query.trim() && (
						<Button
							variant="outlined"
							startIcon={<FilterAltIcon />}
							onClick={() => onDepartmentSelect(department)}
						>
							Filter to {department}
						</Button>
					)}

					<Box>
						<Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 800 }}>
							{query.trim()
								? "People matching your search"
								: "Closest connected people"}
						</Typography>
						<Stack spacing={0.9}>
							{shownPeople.length > 0 ? (
								shownPeople.map((item) => (
									<PersonResult
										key={item.member.user_id}
										member={item.member}
										reasons={item.reasons}
										onSelect={onSelectedMemberChange}
									/>
								))
							) : (
								<Typography variant="body2" color="text.secondary">
									No people in the current filters match this search.
								</Typography>
							)}
						</Stack>
					</Box>
				</Stack>
			</CardContent>
		</GlassCard>
	);
}

function PersonResult({
	member,
	reasons,
	onSelect,
}: {
	member: Member;
	reasons: string[];
	onSelect: (memberId: string) => void;
}) {
	return (
		<ButtonBase
			component="button"
			type="button"
			aria-label={`Focus ${getDisplayName(member)}${reasons.length ? `. Shared signals: ${reasons.join(", ")}` : ""}`}
			onClick={() => onSelect(member.user_id)}
			sx={{
				justifyContent: "flex-start",
				gap: 1.25,
				p: 1,
				borderRadius: 3,
				textAlign: "left",
				bgcolor: "rgba(154, 100, 217, 0.07)",
				font: "inherit",
				width: "100%",
			}}
		>
			<Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 800 }}>
				{getInitials(member)}
			</Avatar>
			<Box sx={{ minWidth: 0 }}>
				<Typography variant="body2" sx={{ fontWeight: 800 }}>
					{getDisplayName(member)}
				</Typography>
				<Typography variant="caption" color="text.secondary">
					{reasons.join(" · ") || "Visible in graph"}
				</Typography>
			</Box>
		</ButtonBase>
	);
}
