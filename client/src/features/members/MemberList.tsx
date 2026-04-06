import HubIcon from "@mui/icons-material/Hub";
import SearchIcon from "@mui/icons-material/Search";
import {
	Avatar,
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	InputAdornment,
	MenuItem,
	TextField,
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

type GraphLayout = "cluster" | "orbit" | "columns";

interface GraphNode {
	id: string;
	x: number;
	y: number;
	label: string;
	group: string;
	member: Member;
}

interface GraphLink {
	sourceId: string;
	targetId: string;
	group: string;
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

function groupMembersByBatch(members: Member[]) {
	const map = new Map<string, Member[]>();
	for (const member of members) {
		const key = member.batch?.trim() || "No batch";
		const list = map.get(key);
		if (list) {
			list.push(member);
		} else {
			map.set(key, [member]);
		}
	}

	return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function buildGraphData(members: Member[], layout: GraphLayout) {
	const groups = groupMembersByBatch(members);
	const batchCenters = new Map<string, { x: number; y: number }>();
	const nodes: GraphNode[] = [];
	const links: GraphLink[] = [];

	if (groups.length === 0) {
		return { nodes, links, centers: batchCenters };
	}

	if (layout === "columns") {
		const colCount = Math.max(1, groups.length);
		const colGap = GRAPH_WIDTH / (colCount + 1);
		groups.forEach(([batch, batchMembers], batchIndex) => {
			const centerX = colGap * (batchIndex + 1);
			const centerY = GRAPH_HEIGHT * 0.5;
			batchCenters.set(batch, { x: centerX, y: centerY });
			batchMembers.forEach((member, memberIndex) => {
				const row = memberIndex % 10;
				const lane = Math.floor(memberIndex / 10);
				const x =
					centerX +
					(lane % 2 === 0 ? -1 : 1) * (12 + Math.floor(lane / 2) * 30);
				const y = 88 + row * 50;
				nodes.push({
					id: member.user_id,
					x,
					y,
					label: getFullName(member),
					group: batch,
					member,
				});
				if (memberIndex > 0) {
					links.push({
						sourceId: batchMembers[0].user_id,
						targetId: member.user_id,
						group: batch,
					});
				}
			});
		});
	} else {
		const centerX = GRAPH_WIDTH * 0.5;
		const centerY = GRAPH_HEIGHT * 0.5;
		const groupRadius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.33;

		groups.forEach(([batch, batchMembers], batchIndex) => {
			const groupAngle = (Math.PI * 2 * batchIndex) / groups.length;
			const groupX = centerX + Math.cos(groupAngle) * groupRadius;
			const groupY = centerY + Math.sin(groupAngle) * groupRadius;
			batchCenters.set(batch, { x: groupX, y: groupY });

			const nodeRadius =
				layout === "orbit"
					? 40 + batchMembers.length * 3
					: 30 + batchMembers.length * 2;
			batchMembers.forEach((member, memberIndex) => {
				const nodeAngle =
					(Math.PI * 2 * memberIndex) / Math.max(1, batchMembers.length);
				const spread = layout === "orbit" ? nodeRadius * 1.7 : nodeRadius;
				const x = groupX + Math.cos(nodeAngle) * spread;
				const y = groupY + Math.sin(nodeAngle) * spread;
				nodes.push({
					id: member.user_id,
					x,
					y,
					label: getFullName(member),
					group: batch,
					member,
				});
				if (memberIndex > 0) {
					links.push({
						sourceId: batchMembers[0].user_id,
						targetId: member.user_id,
						group: batch,
					});
				}
			});
		});
	}

	return { nodes, links, centers: batchCenters };
}

export default function MemberList() {
	const theme = useTheme();
	const { members, isLoading, error } = useMembersListData();
	const [search, setSearch] = useState("");
	const [layout, setLayout] = useState<GraphLayout>("cluster");
	const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		if (!members) return [];
		if (!search.trim()) return members;
		const q = search.toLowerCase();
		return members.filter((m) => {
			const name = `${m.given_name} ${m.surname}`.toLowerCase();
			const dept = (m.department || "").toLowerCase();
			const role = (m.member_role || "").toLowerCase();
			const batch = (m.batch || "").toLowerCase();
			const degree = (m.degree || "").toLowerCase();
			const school = (m.school || "").toLowerCase();
			return (
				name.includes(q) ||
				dept.includes(q) ||
				role.includes(q) ||
				batch.includes(q) ||
				degree.includes(q) ||
				school.includes(q)
			);
		});
	}, [members, search]);

	const graphData = useMemo(
		() => buildGraphData(filtered, layout),
		[filtered, layout],
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
							display: "flex",
							justifyContent: "space-between",
							alignItems: { xs: "flex-start", md: "center" },
							flexDirection: { xs: "column", md: "row" },
							gap: 2,
						}}
					>
						<Box sx={{ maxWidth: 620 }}>
							<Typography variant="h3" sx={{ mb: 1.5 }}>
								Member Graph
							</Typography>
							<Typography variant="body1" color="text.secondary">
								Interactive network view of all active members. For this MVP,
								nodes are grouped by batch so you can instantly see cohort
								composition.
							</Typography>
						</Box>

						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: {
									xs: "1fr",
									sm: "repeat(2, minmax(0, 1fr))",
								},
								gap: 1.5,
								width: "100%",
								maxWidth: 460,
							}}
						>
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
							/>
							<TextField
								select
								size="small"
								label="Graph version"
								value={layout}
								onChange={(event) =>
									setLayout(event.target.value as GraphLayout)
								}
							>
								<MenuItem value="cluster">Version A · Cluster</MenuItem>
								<MenuItem value="orbit">Version B · Orbit</MenuItem>
								<MenuItem value="columns">Version C · Batch Columns</MenuItem>
							</TextField>
						</Box>
					</Box>

					<Box
						sx={{
							mt: 1.5,
							display: "flex",
							gap: 1.5,
							flexWrap: "wrap",
							alignItems: "center",
						}}
					>
						<Chip
							icon={<HubIcon />}
							label={`${graphData.centers.size} batches`}
							size="small"
							variant="outlined"
						/>
						<Chip
							label={`${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
							size="small"
							variant="outlined"
						/>
						{activeNode && (
							<Button
								size="small"
								variant="text"
								onClick={() => setActiveMemberId(null)}
							>
								Clear selection
							</Button>
						)}
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
									{[...graphData.centers.entries()].map(([batch, center]) => (
										<g key={`center-${batch}`}>
											<circle
												cx={center.x}
												cy={center.y}
												r={46}
												fill={alpha(
													theme.palette.primary.main,
													theme.palette.mode === "light" ? 0.08 : 0.18,
												)}
												stroke={alpha(theme.palette.primary.main, 0.28)}
											/>
											<text
												x={center.x}
												y={center.y + 4}
												fontSize="12"
												textAnchor="middle"
												fill={theme.palette.text.secondary}
											>
												{batch}
											</text>
										</g>
									))}

									{graphData.links.map((link) => {
										const source = graphData.nodes.find(
											(node) => node.id === link.sourceId,
										);
										const target = graphData.nodes.find(
											(node) => node.id === link.targetId,
										);
										if (!source || !target) return null;
										const active = activeMemberId
											? link.sourceId === activeMemberId ||
												link.targetId === activeMemberId
											: false;
										return (
											<line
												key={`${link.sourceId}-${link.targetId}`}
												x1={source.x}
												y1={source.y}
												x2={target.x}
												y2={target.y}
												stroke={
													active
														? alpha(theme.palette.primary.main, 0.62)
														: alpha(
																theme.palette.primary.main,
																theme.palette.mode === "light" ? 0.18 : 0.28,
															)
												}
												strokeWidth={active ? 2.6 : 1.4}
											/>
										);
									})}

									{graphData.nodes.map((node) => {
										const isActive = node.id === activeMemberId;
										return (
											<g key={node.id}>
												<title>{`${node.label} · ${node.group}`}</title>
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
																: alpha(theme.palette.primary.main, 0.8)
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
											label={`Batch: ${activeNode.group}`}
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
									Click a node to inspect member metadata. Switch graph versions
									to compare layouts.
								</Typography>
							)}
						</CardContent>
					</GlassCard>
				</Box>
			)}
		</Box>
	);
}
