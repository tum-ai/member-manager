import SearchIcon from "@mui/icons-material/Search";
import {
	Avatar,
	Box,
	CardContent,
	Chip,
	CircularProgress,
	FormControlLabel,
	Grid,
	InputAdornment,
	MenuItem,
	Switch,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";

import GlassCard from "../../components/ui/GlassCard";
import { useMembersListData } from "../../hooks/useMembersListData";
import type { Member } from "../../types";

const GRAPH_WIDTH = 960;
const GRAPH_HEIGHT = 620;

type ViewMode = "graph" | "list";

interface BatchCenter {
	label: string;
	x: number;
	y: number;
	count: number;
}

interface GraphNode {
	id: string;
	member: Member;
	label: string;
	batchLabel: string;
	x: number;
	y: number;
	centerX: number;
	centerY: number;
}

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last).toUpperCase();
}

function getFullName(member: Member): string {
	return (
		`${member.given_name || ""} ${member.surname || ""}`.trim() ||
		"Unnamed Member"
	);
}

function getBatchLabel(member: Member): string {
	return member.batch?.trim() || "No batch";
}

function groupMembersByBatch(members: Member[]) {
	const map = new Map<string, Member[]>();
	for (const member of members) {
		const key = getBatchLabel(member);
		const existing = map.get(key);
		if (existing) {
			existing.push(member);
		} else {
			map.set(key, [member]);
		}
	}

	return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function buildClusterData(members: Member[], groupByBatch: boolean) {
	const grouped = groupByBatch
		? groupMembersByBatch(members)
		: [["All members", members]];

	const centers: BatchCenter[] = [];
	const nodes: GraphNode[] = [];

	if (grouped.length === 0) {
		return { centers, nodes };
	}

	const worldCenterX = GRAPH_WIDTH * 0.5;
	const worldCenterY = GRAPH_HEIGHT * 0.5;
	const centerOrbit = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.33;

	grouped.forEach(([label, batchMembers], groupIndex) => {
		const centerX =
			grouped.length === 1
				? worldCenterX
				: worldCenterX +
					Math.cos((Math.PI * 2 * groupIndex) / grouped.length) * centerOrbit;
		const centerY =
			grouped.length === 1
				? worldCenterY
				: worldCenterY +
					Math.sin((Math.PI * 2 * groupIndex) / grouped.length) * centerOrbit;

		centers.push({
			label,
			x: centerX,
			y: centerY,
			count: batchMembers.length,
		});

		const ringDistance = 44;
		batchMembers.forEach((member, memberIndex) => {
			const membersInRing = Math.max(
				6,
				Math.ceil(Math.sqrt(batchMembers.length)) * 3,
			);
			const ring = Math.floor(memberIndex / membersInRing);
			const ringIndex = memberIndex % membersInRing;
			const angle = (Math.PI * 2 * ringIndex) / membersInRing;
			const spread = 62 + ring * ringDistance;
			nodes.push({
				id: member.user_id,
				member,
				label: getFullName(member),
				batchLabel: getBatchLabel(member),
				x: centerX + Math.cos(angle) * spread,
				y: centerY + Math.sin(angle) * spread,
				centerX,
				centerY,
			});
		});
	});

	return { centers, nodes };
}

function MemberCard({ member }: { member: Member }) {
	const theme = useTheme();
	const fullName = getFullName(member);

	return (
		<GlassCard variant="interactive">
			<CardContent sx={{ p: 2.5 }}>
				<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
					<Avatar
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
							{fullName}
						</Typography>
						{member.member_role && (
							<Typography
								variant="body2"
								color="primary"
								sx={{ lineHeight: 1.4 }}
							>
								{member.member_role}
							</Typography>
						)}
						{member.department && (
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
					<Chip label={getBatchLabel(member)} size="small" variant="outlined" />
					{member.degree && (
						<Chip label={member.degree} size="small" variant="outlined" />
					)}
					{member.school && (
						<Chip label={member.school} size="small" variant="outlined" />
					)}
				</Box>
			</CardContent>
		</GlassCard>
	);
}

export default function MemberList() {
	const theme = useTheme();
	const { members, isLoading, error } = useMembersListData();
	const [search, setSearch] = useState("");
	const [selectedBatch, setSelectedBatch] = useState("all");
	const [groupByBatch, setGroupByBatch] = useState(true);
	const [viewMode, setViewMode] = useState<ViewMode>("graph");
	const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

	const availableBatches = useMemo(() => {
		if (!members) return [];
		return [...new Set(members.map((member) => getBatchLabel(member)))].sort(
			(a, b) => a.localeCompare(b),
		);
	}, [members]);

	const filtered = useMemo(() => {
		if (!members) return [];
		const query = search.trim().toLowerCase();
		return members.filter((member) => {
			const batch = getBatchLabel(member);
			if (selectedBatch !== "all" && batch !== selectedBatch) {
				return false;
			}
			if (!query) {
				return true;
			}
			const haystack = [
				getFullName(member),
				member.department || "",
				member.member_role || "",
				member.degree || "",
				member.school || "",
				batch,
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(query);
		});
	}, [members, search, selectedBatch]);

	const graphData = useMemo(
		() => buildClusterData(filtered, groupByBatch),
		[filtered, groupByBatch],
	);
	const activeNode = useMemo(
		() => graphData.nodes.find((node) => node.id === activeMemberId) || null,
		[graphData.nodes, activeMemberId],
	);

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
			<GlassCard variant="elevated" sx={{ mb: 4, overflow: "hidden" }}>
				<CardContent sx={{ p: { xs: 3, md: 4 } }}>
					<Box
						sx={{
							display: "grid",
							gap: 1.5,
							gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
							alignItems: { xs: "stretch", md: "center" },
						}}
					>
						<Box sx={{ maxWidth: 680 }}>
							<Typography variant="h3" sx={{ mb: 1.25 }}>
								Members
							</Typography>
							<Typography variant="body1" color="text.secondary">
								Switch between graph and list. In graph mode, batch grouping can
								be toggled on/off without creating arbitrary member-to-member
								links.
							</Typography>
						</Box>
						<ToggleButtonGroup
							size="small"
							exclusive
							value={viewMode}
							onChange={(_, nextValue: ViewMode | null) => {
								if (nextValue) setViewMode(nextValue);
							}}
						>
							<ToggleButton value="graph">Graph</ToggleButton>
							<ToggleButton value="list">List</ToggleButton>
						</ToggleButtonGroup>
					</Box>

					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: {
								xs: "1fr",
								sm: "repeat(3, minmax(0, 1fr))",
							},
							gap: 1.5,
							mt: 2.5,
						}}
					>
						<TextField
							size="small"
							placeholder="Search members..."
							value={search}
							onChange={(event) => setSearch(event.target.value)}
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
						<TextField
							select
							size="small"
							label="Batch filter"
							value={selectedBatch}
							onChange={(event) => {
								setSelectedBatch(event.target.value);
								setActiveMemberId(null);
							}}
						>
							<MenuItem value="all">All batches</MenuItem>
							{availableBatches.map((batch) => (
								<MenuItem key={batch} value={batch}>
									{batch}
								</MenuItem>
							))}
						</TextField>
						<FormControlLabel
							control={
								<Switch
									checked={groupByBatch}
									onChange={(event) => setGroupByBatch(event.target.checked)}
									disabled={viewMode === "list"}
								/>
							}
							label="Group by batch"
							sx={{ px: 1 }}
						/>
					</Box>

					<Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
						<Chip
							label={`${filtered.length} visible member${filtered.length === 1 ? "" : "s"}`}
							size="small"
							variant="outlined"
						/>
						<Chip
							label={`${availableBatches.length} batches`}
							size="small"
							variant="outlined"
						/>
					</Box>
				</CardContent>
			</GlassCard>

			{filtered.length === 0 ? (
				<GlassCard sx={{ textAlign: "center", py: 8 }}>
					<Typography color="text.secondary">
						No members match the selected filters.
					</Typography>
				</GlassCard>
			) : viewMode === "list" ? (
				<Grid container spacing={2}>
					{filtered.map((member) => (
						<Grid key={member.user_id} size={{ xs: 12, sm: 6, md: 4 }}>
							<MemberCard member={member} />
						</Grid>
					))}
				</Grid>
			) : (
				<Box
					sx={{
						display: "grid",
						gap: 2,
						gridTemplateColumns: { xs: "1fr", lg: "1fr 320px" },
					}}
				>
					<GlassCard>
						<CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
							<Box
								sx={{
									position: "relative",
									borderRadius: 3,
									overflow: "hidden",
									background:
										theme.palette.mode === "light"
											? `radial-gradient(circle at top, ${alpha(theme.palette.primary.main, 0.09)}, transparent 60%), ${alpha(theme.palette.background.paper, 0.7)}`
											: `radial-gradient(circle at top, ${alpha(theme.palette.primary.main, 0.2)}, transparent 58%), ${alpha(theme.palette.background.default, 0.36)}`,
								}}
							>
								<Box
									component="svg"
									viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
									sx={{
										width: "100%",
										height: { xs: 460, md: 620 },
										display: "block",
									}}
								>
									<title>Member graph grouped by batch</title>
									{graphData.centers.map((center) => (
										<g key={center.label}>
											<circle
												cx={center.x}
												cy={center.y}
												r={38}
												fill={alpha(
													theme.palette.primary.main,
													theme.palette.mode === "light" ? 0.08 : 0.18,
												)}
												stroke={alpha(theme.palette.primary.main, 0.28)}
											/>
											<text
												x={center.x}
												y={center.y + 3}
												fontSize="12"
												textAnchor="middle"
												fill={theme.palette.text.secondary}
											>
												{center.label}
											</text>
										</g>
									))}

									{graphData.nodes.map((node) => {
										const isActive = node.id === activeMemberId;
										return (
											<g key={node.id}>
												<line
													x1={node.centerX}
													y1={node.centerY}
													x2={node.x}
													y2={node.y}
													stroke={alpha(
														theme.palette.primary.main,
														isActive ? 0.5 : 0.2,
													)}
													strokeWidth={isActive ? 1.8 : 1.1}
												/>
												<a
													href={`#member-${node.id}`}
													aria-label={`Inspect ${node.label}`}
													onClick={(event) => {
														event.preventDefault();
														setActiveMemberId(node.id);
													}}
												>
													<circle
														cx={node.x}
														cy={node.y}
														r={isActive ? 14 : 11}
														fill={
															isActive
																? theme.palette.primary.main
																: alpha(theme.palette.primary.main, 0.82)
														}
														stroke={alpha(
															theme.palette.common.white,
															theme.palette.mode === "light" ? 0.86 : 0.55,
														)}
														strokeWidth={isActive ? 2.4 : 1.8}
														style={{ cursor: "pointer" }}
													/>
												</a>
											</g>
										);
									})}
								</Box>
							</Box>
						</CardContent>
					</GlassCard>

					<GlassCard variant="interactive" sx={{ alignSelf: "start" }}>
						<CardContent>
							<Typography variant="h6" sx={{ mb: 1 }}>
								Node details
							</Typography>
							{activeNode ? (
								<>
									<Box
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 1.5,
											mb: 1.5,
										}}
									>
										<Avatar
											sx={{
												bgcolor: alpha(theme.palette.primary.main, 0.2),
												color: theme.palette.text.primary,
											}}
										>
											{getInitials(activeNode.member)}
										</Avatar>
										<Box>
											<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
												{activeNode.label}
											</Typography>
											<Typography variant="body2" color="primary">
												{activeNode.member.member_role || "Member"}
											</Typography>
										</Box>
									</Box>
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
										<Chip
											label={`Batch: ${activeNode.batchLabel}`}
											size="small"
											variant="outlined"
										/>
										{activeNode.member.department && (
											<Chip
												label={activeNode.member.department}
												size="small"
												variant="outlined"
											/>
										)}
										{activeNode.member.degree && (
											<Chip
												label={activeNode.member.degree}
												size="small"
												variant="outlined"
											/>
										)}
									</Box>
								</>
							) : (
								<Typography color="text.secondary" variant="body2">
									Click a node to inspect member metadata.
								</Typography>
							)}
						</CardContent>
					</GlassCard>
				</Box>
			)}
		</Box>
	);
}
