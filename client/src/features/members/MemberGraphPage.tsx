import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import BubbleChartOutlinedIcon from "@mui/icons-material/BubbleChartOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import {
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	FormControl,
	FormControlLabel,
	InputLabel,
	MenuItem,
	Select,
	type SelectChangeEvent,
	Stack,
	Switch,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import GlassCard from "../../components/ui/GlassCard";
import { useMembersListData } from "../../hooks/useMembersListData";
import type { Member } from "../../types";
import {
	buildMemberGraph,
	DEFAULT_MEMBER_GRAPH_REASON_KINDS,
	MEMBER_GRAPH_REASON_KINDS,
	type MemberGraphData,
	type MemberGraphEdge,
	type MemberGraphNode,
	type MemberGraphReasonKind,
} from "./memberGraphUtils";

type SimNode = MemberGraphNode & {
	x: number;
	y: number;
	vx: number;
	vy: number;
};

const REASON_LABELS: Record<MemberGraphReasonKind, string> = {
	batch: "Batch",
	department: "Department",
	field: "Field",
	research: "Research",
	school: "School",
	location: "Location",
};

function getReasonSummary(edge: MemberGraphEdge): string {
	return edge.reasons
		.map((reason) => `${reason.label}: ${reason.value}`)
		.join(" · ");
}

function getInitials(member: Member): string {
	const first = member.given_name?.charAt(0) || "";
	const last = member.surname?.charAt(0) || "";
	return (first + last || member.email?.charAt(0) || "?").toUpperCase();
}

function getHoverConnections(
	graph: MemberGraphData,
	nodeId: string,
): { neighbor: MemberGraphNode; edge: MemberGraphEdge }[] {
	const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
	return graph.edges
		.filter((edge) => edge.source === nodeId || edge.target === nodeId)
		.map((edge) => {
			const neighborId = edge.source === nodeId ? edge.target : edge.source;
			const neighbor = nodesById.get(neighborId);
			return neighbor ? { neighbor, edge } : null;
		})
		.filter(
			(entry): entry is { neighbor: MemberGraphNode; edge: MemberGraphEdge } =>
				Boolean(entry),
		)
		.sort((left, right) => {
			if (right.edge.weight !== left.edge.weight) {
				return right.edge.weight - left.edge.weight;
			}
			return left.neighbor.label.localeCompare(right.neighbor.label);
		});
}

function MemberGraphDetails({
	graph,
	selectedId,
	onSelectedIdChange,
}: {
	graph: MemberGraphData;
	selectedId: string;
	onSelectedIdChange: (nodeId: string) => void;
}) {
	const selectedNode =
		graph.nodes.find((node) => node.id === selectedId) ??
		getDefaultSelectedNode(graph) ??
		null;
	const connections = selectedNode
		? getHoverConnections(graph, selectedNode.id)
		: [];

	if (!selectedNode) {
		return null;
	}

	return (
		<Box
			sx={{
				mt: 2,
				display: "grid",
				gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" },
				gap: 2,
				alignItems: "start",
			}}
		>
			<FormControl size="small" fullWidth>
				<InputLabel id="member-graph-inspector-label">
					Inspect member
				</InputLabel>
				<Select
					labelId="member-graph-inspector-label"
					value={selectedNode.id}
					label="Inspect member"
					onChange={(event: SelectChangeEvent<string>) =>
						onSelectedIdChange(event.target.value)
					}
				>
					{graph.nodes.map((node) => (
						<MenuItem key={node.id} value={node.id}>
							{node.label}
						</MenuItem>
					))}
				</Select>
			</FormControl>

			<Box
				aria-live="polite"
				sx={{
					p: 1.5,
					borderRadius: 2,
					backgroundColor: (theme) =>
						theme.palette.mode === "light"
							? alpha(theme.palette.primary.main, 0.04)
							: alpha("#F5EFFF", 0.05),
				}}
			>
				<Stack
					direction={{ xs: "column", sm: "row" }}
					spacing={1}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", sm: "center" }}
				>
					<Box sx={{ minWidth: 0 }}>
						<Typography sx={{ fontWeight: 800 }}>
							{selectedNode.label}
						</Typography>
						{selectedNode.subtitle && (
							<Typography variant="body2" color="text.secondary">
								{selectedNode.subtitle}
							</Typography>
						)}
					</Box>
					<Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
						<Chip
							size="small"
							label={`Component ${selectedNode.componentId}`}
						/>
						<Chip
							size="small"
							label={`${selectedNode.componentSize} members`}
						/>
						<Chip size="small" label={`${selectedNode.degree} shown edges`} />
					</Stack>
				</Stack>

				<Box
					sx={{
						mt: 1.5,
						display: "grid",
						gridTemplateColumns: {
							xs: "1fr",
							md: "repeat(2, minmax(0, 1fr))",
						},
						gap: 1,
					}}
				>
					{connections.slice(0, 6).map(({ neighbor, edge }) => (
						<Box key={edge.id}>
							<Typography variant="body2" sx={{ fontWeight: 700 }}>
								{neighbor.label}
							</Typography>
							<Typography variant="caption" color="text.secondary">
								{getReasonSummary(edge)}
							</Typography>
						</Box>
					))}
					{connections.length === 0 && (
						<Typography variant="body2" color="text.secondary">
							No shown edge for the selected attributes.
						</Typography>
					)}
				</Box>
			</Box>
		</Box>
	);
}

function getDefaultSelectedNode(
	graph: MemberGraphData,
): MemberGraphNode | null {
	return graph.nodes.reduce<MemberGraphNode | null>((best, node) => {
		if (!best) return node;
		if (node.degree !== best.degree) {
			return node.degree > best.degree ? node : best;
		}
		if (node.componentSize !== best.componentSize) {
			return node.componentSize > best.componentSize ? node : best;
		}
		return node.label.localeCompare(best.label) < 0 ? node : best;
	}, null);
}

function MemberGraphCanvas({
	graph,
	compact,
	selectedId,
	onSelectedIdChange,
}: {
	graph: MemberGraphData;
	compact: boolean;
	selectedId: string | null;
	onSelectedIdChange: (nodeId: string) => void;
}) {
	const theme = useTheme();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const nodesRef = useRef<SimNode[]>([]);
	const graphRef = useRef(graph);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [hoverPoint, setHoverPoint] = useState({ x: 0, y: 0 });
	const activeId = hoveredId ?? selectedId;
	const hoveredNode = graph.nodes.find((node) => node.id === hoveredId) ?? null;
	const hoverConnections = hoveredNode
		? getHoverConnections(graph, hoveredNode.id)
		: [];

	useEffect(() => {
		graphRef.current = graph;
		const previous = new Map(nodesRef.current.map((node) => [node.id, node]));
		const width = containerRef.current?.clientWidth || 960;
		const height = containerRef.current?.clientHeight || 520;
		nodesRef.current = graph.nodes.map((node, index) => {
			const existing = previous.get(node.id);
			if (existing) {
				return {
					...node,
					x: existing.x,
					y: existing.y,
					vx: existing.vx,
					vy: existing.vy,
				};
			}
			const angle = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
			const radius = Math.min(width, height) * 0.28;
			return {
				...node,
				x: width / 2 + Math.cos(angle) * radius,
				y: height * 0.4 + Math.sin(angle) * radius,
				vx: 0,
				vy: 0,
			};
		});
	}, [graph]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const drawingCanvas = canvas;
		const drawingContainer = container;
		const context = ctx;
		let raf = 0;
		let width = drawingContainer.clientWidth;
		let height = drawingContainer.clientHeight;
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		const colors = {
			background:
				theme.palette.mode === "light"
					? "rgba(255, 255, 255, 0.92)"
					: "rgba(13, 2, 20, 0.32)",
			mesh:
				theme.palette.mode === "light"
					? alpha(theme.palette.primary.main, 0.13)
					: alpha("#F5EFFF", 0.18),
			meshStrong:
				theme.palette.mode === "light"
					? alpha(theme.palette.primary.main, 0.34)
					: alpha("#F5EFFF", 0.34),
			node: theme.palette.primary.main,
			nodeMuted:
				theme.palette.mode === "light"
					? alpha(theme.palette.primary.dark, 0.62)
					: alpha("#D0C3E3", 0.78),
			nodeInner: theme.palette.mode === "light" ? "#FFFFFF" : "#F5EFFF",
			text: theme.palette.text.primary,
			textSecondary: theme.palette.text.secondary,
		};

		function resize() {
			const dpr = window.devicePixelRatio || 1;
			width = drawingContainer.clientWidth;
			height = drawingContainer.clientHeight;
			drawingCanvas.width = Math.max(1, width * dpr);
			drawingCanvas.height = Math.max(1, height * dpr);
			drawingCanvas.style.width = `${width}px`;
			drawingCanvas.style.height = `${height}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function draw() {
			const nodes = nodesRef.current;
			const edges = graphRef.current.edges;
			const byId = new Map(nodes.map((node) => [node.id, node]));
			const active = activeId ? byId.get(activeId) : null;
			const connectedToActive = new Set<string>();
			if (active) {
				for (const edge of edges) {
					if (edge.source === active.id) connectedToActive.add(edge.target);
					if (edge.target === active.id) connectedToActive.add(edge.source);
				}
			}

			if (!prefersReducedMotion) {
				const cx = width / 2;
				const cy = height * 0.4;
				const repulsion = compact ? 850 : 1350;
				const restLength = compact ? 76 : 112;

				for (let i = 0; i < nodes.length; i += 1) {
					const left = nodes[i];
					for (let j = i + 1; j < nodes.length; j += 1) {
						const right = nodes[j];
						let dx = left.x - right.x;
						let dy = left.y - right.y;
						let distanceSq = dx * dx + dy * dy;
						if (distanceSq < 4) {
							dx = Math.random() - 0.5;
							dy = Math.random() - 0.5;
							distanceSq = 4;
						}
						const distance = Math.sqrt(distanceSq);
						const force = repulsion / distanceSq;
						left.vx += (dx / distance) * force;
						left.vy += (dy / distance) * force;
						right.vx -= (dx / distance) * force;
						right.vy -= (dy / distance) * force;
					}

					const componentOffset =
						((left.componentId % 5) - 2) * (compact ? 18 : 32);
					left.vx += (cx + componentOffset - left.x) * 0.0028;
					left.vy += (cy - left.y) * 0.0028;
				}

				for (const edge of edges) {
					const source = byId.get(edge.source);
					const target = byId.get(edge.target);
					if (!source || !target) continue;
					const dx = target.x - source.x;
					const dy = target.y - source.y;
					const distance = Math.sqrt(dx * dx + dy * dy) || 1;
					const force = (distance - restLength + edge.weight * -7) * 0.0035;
					source.vx += (dx / distance) * force;
					source.vy += (dy / distance) * force;
					target.vx -= (dx / distance) * force;
					target.vy -= (dy / distance) * force;
				}

				for (const node of nodes) {
					node.vx *= 0.84;
					node.vy *= 0.84;
					node.x += node.vx;
					node.y += node.vy;
					const margin = compact ? 32 : 44;
					node.x = Math.max(margin, Math.min(width - margin, node.x));
					node.y = Math.max(margin, Math.min(height - margin, node.y));
				}
			}

			context.clearRect(0, 0, width, height);
			context.fillStyle = colors.background;
			context.fillRect(0, 0, width, height);

			for (const edge of edges) {
				const source = byId.get(edge.source);
				const target = byId.get(edge.target);
				if (!source || !target) continue;
				const isActive =
					active && (edge.source === active.id || edge.target === active.id);
				context.strokeStyle = isActive ? colors.meshStrong : colors.mesh;
				context.lineWidth = isActive ? 1.6 + edge.weight * 0.35 : 0.7;
				context.beginPath();
				context.moveTo(source.x, source.y);
				context.lineTo(target.x, target.y);
				context.stroke();
			}

			for (const node of nodes) {
				const isActive = node.id === active?.id;
				const isNeighbor = connectedToActive.has(node.id);
				const isDimmed = active && !isActive && !isNeighbor;
				const radius = (compact ? 6 : 8) + Math.min(6, node.degree * 0.28);
				const color =
					node.member.member_status === "alumni"
						? colors.nodeMuted
						: colors.node;
				const halo = context.createRadialGradient(
					node.x,
					node.y,
					radius * 0.5,
					node.x,
					node.y,
					radius * (isActive ? 4.4 : 3),
				);
				halo.addColorStop(
					0,
					isDimmed ? alpha(color, 0.05) : alpha(color, isActive ? 0.32 : 0.18),
				);
				halo.addColorStop(1, alpha(color, 0));
				context.fillStyle = halo;
				context.beginPath();
				context.arc(
					node.x,
					node.y,
					radius * (isActive ? 4.4 : 3),
					0,
					Math.PI * 2,
				);
				context.fill();

				context.save();
				context.globalAlpha = isDimmed ? 0.24 : 1;
				context.shadowColor = color;
				context.shadowBlur = isActive ? 16 : 7;
				context.fillStyle = color;
				context.beginPath();
				context.arc(node.x, node.y, radius, 0, Math.PI * 2);
				context.fill();
				context.shadowBlur = 0;
				context.fillStyle = colors.nodeInner;
				context.font = `700 ${compact ? 8 : 9}px Manrope, sans-serif`;
				context.textAlign = "center";
				context.textBaseline = "middle";
				context.fillText(getInitials(node.member), node.x, node.y + 0.5);
				context.restore();

				if (isActive || (!active && node.degree > 0 && !compact)) {
					context.fillStyle = isActive ? colors.text : colors.textSecondary;
					context.font = `${isActive ? 700 : 600} 12px Manrope, sans-serif`;
					context.textAlign = "center";
					context.textBaseline = "top";
					context.fillText(
						node.label.split(" ")[0],
						node.x,
						node.y + radius + 8,
					);
				}
			}

			raf = window.requestAnimationFrame(draw);
		}

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(drawingContainer);
		raf = window.requestAnimationFrame(draw);

		return () => {
			window.cancelAnimationFrame(raf);
			resizeObserver.disconnect();
		};
	}, [activeId, compact, theme]);

	function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		setHoverPoint({ x, y });

		let closest: SimNode | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;
		for (const node of nodesRef.current) {
			const dx = node.x - x;
			const dy = node.y - y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const hitRadius = 20 + Math.min(10, node.degree * 0.35);
			if (distance < hitRadius && distance < closestDistance) {
				closest = node;
				closestDistance = distance;
			}
		}
		setHoveredId(closest?.id ?? null);
	}

	function handlePointerDown(): void {
		if (hoveredId) {
			onSelectedIdChange(hoveredId);
		}
	}

	const tooltipLeft = Math.min(
		Math.max(16, hoverPoint.x + 18),
		(containerRef.current?.clientWidth ?? 900) - 336,
	);
	const tooltipTop = Math.min(
		Math.max(16, hoverPoint.y + 18),
		(containerRef.current?.clientHeight ?? 620) - 260,
	);

	return (
		<Box
			ref={containerRef}
			sx={{
				position: "relative",
				height: { xs: 480, md: 520 },
				overflow: "hidden",
				borderRadius: 2,
				backgroundColor:
					theme.palette.mode === "light"
						? "rgba(255, 255, 255, 0.92)"
						: "rgba(13, 2, 20, 0.28)",
			}}
		>
			<canvas
				ref={canvasRef}
				aria-label="Member graph visualization"
				role="img"
				onPointerMove={handlePointerMove}
				onPointerDown={handlePointerDown}
				onPointerLeave={() => setHoveredId(null)}
				style={{
					display: "block",
					cursor: hoveredNode ? "pointer" : "default",
				}}
			/>

			{hoveredNode && (
				<Box
					sx={{
						position: "absolute",
						left: tooltipLeft,
						top: tooltipTop,
						width: 320,
						maxWidth: "calc(100% - 32px)",
						p: 2,
						borderRadius: 2,
						backgroundColor:
							theme.palette.mode === "light"
								? "rgba(255, 255, 255, 0.96)"
								: "rgba(24, 17, 47, 0.96)",
						boxShadow:
							theme.palette.mode === "light"
								? "0 18px 48px rgba(15, 23, 42, 0.16)"
								: "0 22px 56px rgba(0, 0, 0, 0.34)",
						pointerEvents: "none",
					}}
				>
					<Typography sx={{ fontWeight: 800 }}>{hoveredNode.label}</Typography>
					{hoveredNode.subtitle && (
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ mt: 0.25 }}
						>
							{hoveredNode.subtitle}
						</Typography>
					)}
					<Stack
						direction="row"
						spacing={0.75}
						sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.75 }}
					>
						<Chip size="small" label={`Component ${hoveredNode.componentId}`} />
						<Chip size="small" label={`${hoveredNode.componentSize} members`} />
						<Chip size="small" label={`${hoveredNode.degree} edges`} />
					</Stack>

					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ display: "block", mt: 1.5, mb: 0.75 }}
					>
						Grouped with
					</Typography>
					<Stack spacing={1}>
						{hoverConnections.slice(0, 5).map(({ neighbor, edge }) => (
							<Box key={edge.id}>
								<Typography variant="body2" sx={{ fontWeight: 700 }}>
									{neighbor.label}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{getReasonSummary(edge)}
								</Typography>
							</Box>
						))}
						{hoverConnections.length === 0 && (
							<Typography variant="body2" color="text.secondary">
								No shared selected attributes.
							</Typography>
						)}
						{hoverConnections.length > 5 && (
							<Typography variant="caption" color="text.secondary">
								+{hoverConnections.length - 5} more connections
							</Typography>
						)}
					</Stack>
				</Box>
			)}
		</Box>
	);
}

export default function MemberGraphPage(): ReactElement {
	const theme = useTheme();
	const { members, isLoading, error } = useMembersListData();
	const [reasonKinds, setReasonKinds] = useState<MemberGraphReasonKind[]>([
		...DEFAULT_MEMBER_GRAPH_REASON_KINDS,
	]);
	const [showAlumni, setShowAlumni] = useState(true);
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

	const graphMembers = useMemo(() => {
		return (members ?? []).filter((member) => {
			const status =
				member.member_status || (member.active ? "active" : "inactive");
			return showAlumni ? status !== "inactive" : status === "active";
		});
	}, [members, showAlumni]);

	const graph = useMemo(
		() => buildMemberGraph(graphMembers, { reasonKinds }),
		[graphMembers, reasonKinds],
	);

	useEffect(() => {
		const defaultNode = getDefaultSelectedNode(graph);
		if (!selectedNodeId && defaultNode) {
			setSelectedNodeId(defaultNode.id);
			return;
		}
		if (
			selectedNodeId &&
			!graph.nodes.some((node) => node.id === selectedNodeId)
		) {
			setSelectedNodeId(defaultNode?.id ?? null);
		}
	}, [graph, selectedNodeId]);

	const isolatedCount = graph.nodes.filter((node) => node.degree === 0).length;
	const compact = graph.nodes.length > 120;

	function handleReasonChange(
		_event: React.MouseEvent<HTMLElement>,
		nextKinds: MemberGraphReasonKind[],
	): void {
		if (nextKinds.length > 0) {
			setReasonKinds(nextKinds);
		}
	}

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
				<Typography color="text.secondary">Loading graph...</Typography>
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ textAlign: "center", py: 8 }}>
				<Typography color="error">
					Failed to load the member graph. Please try again later.
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ py: 2 }}>
			<GlassCard variant="elevated" sx={{ overflow: "hidden" }}>
				<CardContent sx={{ p: { xs: 2, md: 3 } }}>
					<Box
						sx={{
							display: "flex",
							alignItems: { xs: "flex-start", md: "center" },
							justifyContent: "space-between",
							gap: 2,
							flexDirection: { xs: "column", md: "row" },
							mb: 2,
						}}
					>
						<Box sx={{ minWidth: 0 }}>
							<Stack
								direction="row"
								spacing={1}
								alignItems="center"
								sx={{ mb: 1 }}
							>
								<HubOutlinedIcon color="primary" />
								<Typography variant="h4">Member Graph</Typography>
							</Stack>
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ maxWidth: 720 }}
							>
								Explore member clusters formed by shared database fields. Hover
								a node to see why it connects to nearby members.
							</Typography>
						</Box>
						<Button
							component={RouterLink}
							to="/members"
							variant="outlined"
							startIcon={<GroupsOutlinedIcon />}
						>
							Directory
						</Button>
					</Box>

					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: {
								xs: "1fr",
								md: "repeat(4, minmax(0, 1fr))",
							},
							gap: 1.5,
							mb: 2.5,
						}}
					>
						{[
							{ label: "Members", value: graph.nodes.length },
							{ label: "Shown edges", value: graph.edges.length },
							{ label: "Components", value: graph.componentCount },
							{ label: "Largest component", value: graph.largestComponentSize },
						].map((stat) => (
							<Box
								key={stat.label}
								sx={{
									p: 1.35,
									borderRadius: 2,
									backgroundColor:
										theme.palette.mode === "light"
											? alpha(theme.palette.primary.main, 0.06)
											: alpha("#F5EFFF", 0.06),
								}}
							>
								<Typography variant="caption" color="text.secondary">
									{stat.label}
								</Typography>
								<Typography variant="h5" sx={{ mt: 0.25 }}>
									{stat.value}
								</Typography>
							</Box>
						))}
					</Box>

					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: { xs: "stretch", md: "center" },
							flexDirection: { xs: "column", md: "row" },
							gap: 1.5,
							mb: 2,
						}}
					>
						<ToggleButtonGroup
							value={reasonKinds}
							onChange={handleReasonChange}
							aria-label="Graph connection reasons"
							size="small"
							sx={{
								display: "flex",
								flexWrap: "wrap",
								gap: 0.75,
								"& .MuiToggleButtonGroup-grouped": {
									border: 0,
									borderRadius: 999,
									px: 1.5,
									py: 0.75,
									backgroundColor:
										theme.palette.mode === "light"
											? "rgba(255, 255, 255, 0.86)"
											: alpha("#F5EFFF", 0.06),
									"&.Mui-selected": {
										color: "#FFFFFF",
										backgroundColor: theme.palette.primary.main,
										"&:hover": {
											backgroundColor: theme.palette.primary.dark,
										},
									},
								},
							}}
						>
							{MEMBER_GRAPH_REASON_KINDS.map((kind) => (
								<ToggleButton
									key={kind}
									value={kind}
									aria-label={REASON_LABELS[kind]}
								>
									{REASON_LABELS[kind]}
								</ToggleButton>
							))}
						</ToggleButtonGroup>

						<FormControlLabel
							control={
								<Switch
									checked={showAlumni}
									onChange={(event) => setShowAlumni(event.target.checked)}
								/>
							}
							label="Include alumni"
							sx={{ ml: 0 }}
						/>
					</Box>

					<Box
						sx={{
							position: "relative",
							borderRadius: 2,
							overflow: "hidden",
							boxShadow:
								theme.palette.mode === "light"
									? "inset 0 0 0 1px rgba(154, 100, 217, 0.08)"
									: "inset 0 0 0 1px rgba(245, 239, 255, 0.08)",
						}}
					>
						<MemberGraphCanvas
							graph={graph}
							compact={compact}
							selectedId={selectedNodeId}
							onSelectedIdChange={setSelectedNodeId}
						/>
						<Box
							sx={{
								position: "absolute",
								left: { xs: 12, md: 18 },
								bottom: { xs: 12, md: 18 },
								display: "flex",
								gap: 1,
								flexWrap: "wrap",
							}}
						>
							<Chip
								icon={<BubbleChartOutlinedIcon />}
								label={`${isolatedCount} isolated`}
								size="small"
								sx={{
									backgroundColor:
										theme.palette.mode === "light"
											? "rgba(255, 255, 255, 0.86)"
											: alpha("#0D0214", 0.72),
								}}
							/>
							<Chip
								icon={<AccountTreeOutlinedIcon />}
								label={
									graph.logicalEdgeCount === graph.edges.length
										? "Weighted by shared fields"
										: `${graph.edges.length} of ${graph.logicalEdgeCount} edges shown`
								}
								size="small"
								sx={{
									backgroundColor:
										theme.palette.mode === "light"
											? "rgba(255, 255, 255, 0.86)"
											: alpha("#0D0214", 0.72),
								}}
							/>
						</Box>
					</Box>
					<MemberGraphDetails
						graph={graph}
						selectedId={selectedNodeId ?? ""}
						onSelectedIdChange={setSelectedNodeId}
					/>
				</CardContent>
			</GlassCard>
		</Box>
	);
}
