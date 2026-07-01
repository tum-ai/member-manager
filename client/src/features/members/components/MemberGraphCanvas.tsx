import { useTheme } from "next-themes";
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	getHoverConnections,
	getInitials,
	getReasonSummary,
	type MemberGraphData,
	type MemberGraphNode,
} from "@/features/members/memberGraphUtils";

type SimNode = MemberGraphNode & {
	x: number;
	y: number;
	vx: number;
	vy: number;
};

interface CanvasColors {
	edge: string;
	edgeStrong: string;
	node: string;
	nodeMuted: string;
	nodeInner: string;
	text: string;
	textSecondary: string;
}

interface MemberGraphCanvasProps {
	graph: MemberGraphData;
	compact: boolean;
	selectedId: string | null;
	onSelectedIdChange: (nodeId: string) => void;
	highlightIds: Set<string>;
	scoreByUserId: Map<string, number>;
}

const FALLBACK_LIGHT: CanvasColors = {
	edge: "#e5e5e5",
	edgeStrong: "#9a64d9",
	node: "#9a64d9",
	nodeMuted: "#8e8e8e",
	nodeInner: "#ffffff",
	text: "#252525",
	textSecondary: "#6b6b6b",
};

const FALLBACK_DARK: CanvasColors = {
	edge: "rgba(255,255,255,0.14)",
	edgeStrong: "#b98ee6",
	node: "#b98ee6",
	nodeMuted: "#b5b5b5",
	nodeInner: "#1a1a1a",
	text: "#fafafa",
	textSecondary: "#a3a3a3",
};

function readCanvasColors(el: HTMLElement, isDark: boolean): CanvasColors {
	const fallback = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;
	const style = getComputedStyle(el);
	const read = (name: string, fallbackValue: string): string =>
		style.getPropertyValue(name).trim() || fallbackValue;
	const brand = read("--brand", fallback.node);
	return {
		edge: read("--border", fallback.edge),
		edgeStrong: brand,
		node: brand,
		nodeMuted: read("--muted-foreground", fallback.nodeMuted),
		nodeInner: read("--brand-foreground", fallback.nodeInner),
		text: read("--foreground", fallback.text),
		textSecondary: read("--muted-foreground", fallback.textSecondary),
	};
}

// Hand-rolled force-directed canvas. Physics + rendering are ported from the
// original member-graph PR; the theming was rewritten to read shadcn CSS tokens
// so light/dark parity and the query-highlight emphasis come for free.
export function MemberGraphCanvas({
	graph,
	compact,
	selectedId,
	onSelectedIdChange,
	highlightIds,
	scoreByUserId,
}: MemberGraphCanvasProps): React.ReactElement {
	const { resolvedTheme } = useTheme();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const nodesRef = useRef<SimNode[]>([]);
	const graphRef = useRef(graph);
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [hoverPoint, setHoverPoint] = useState({ x: 0, y: 0 });

	// Mirror the latest interaction/highlight state into refs so the animation
	// loop reads current values without tearing down and restarting on hover.
	const activeIdRef = useRef<string | null>(null);
	const highlightRef = useRef(highlightIds);
	const scoreRef = useRef(scoreByUserId);
	activeIdRef.current = hoveredId ?? selectedId;
	highlightRef.current = highlightIds;
	scoreRef.current = scoreByUserId;

	const hoveredNode = graph.nodes.find((node) => node.id === hoveredId) ?? null;
	const hoverConnections = hoveredNode
		? getHoverConnections(graph, hoveredNode.id)
		: [];

	// Seed simulation nodes from the graph, preserving positions across rebuilds.
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

	// The render loop restarts only on layout-density or theme change; node
	// positions live in nodesRef so a theme flip recolors without a relayout.
	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		// Alias to non-null consts so the nested draw/resize closures keep the
		// narrowed type (control-flow narrowing doesn't cross function bodies).
		const context = ctx;
		const canvasEl = canvas;
		const containerEl = container;

		let raf = 0;
		let width = containerEl.clientWidth;
		let height = containerEl.clientHeight;
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const colors = readCanvasColors(containerEl, resolvedTheme === "dark");

		function resize(): void {
			const dpr = window.devicePixelRatio || 1;
			width = containerEl.clientWidth;
			height = containerEl.clientHeight;
			canvasEl.width = Math.max(1, width * dpr);
			canvasEl.height = Math.max(1, height * dpr);
			canvasEl.style.width = `${width}px`;
			canvasEl.style.height = `${height}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		function drawHalo(
			x: number,
			y: number,
			radius: number,
			color: string,
			alpha: number,
		): void {
			// globalAlpha + a color→transparent gradient keeps this format-agnostic
			// (works for both the oklch tokens and the hex brand color).
			context.save();
			context.globalAlpha = alpha;
			const halo = context.createRadialGradient(
				x,
				y,
				radius * 0.5,
				x,
				y,
				radius,
			);
			halo.addColorStop(0, color);
			halo.addColorStop(1, "transparent");
			context.fillStyle = halo;
			context.beginPath();
			context.arc(x, y, radius, 0, Math.PI * 2);
			context.fill();
			context.restore();
		}

		function draw(): void {
			const nodes = nodesRef.current;
			const edges = graphRef.current.edges;
			const byId = new Map(nodes.map((node) => [node.id, node]));
			const activeId = activeIdRef.current;
			const active = activeId ? byId.get(activeId) : null;
			const highlight = highlightRef.current;
			const scores = scoreRef.current;
			const hasHighlight = highlight.size > 0;
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

			for (const edge of edges) {
				const source = byId.get(edge.source);
				const target = byId.get(edge.target);
				if (!source || !target) continue;
				const isActive =
					active && (edge.source === active.id || edge.target === active.id);
				context.strokeStyle = isActive ? colors.edgeStrong : colors.edge;
				context.lineWidth = isActive ? 1.6 + edge.weight * 0.35 : 0.7;
				context.beginPath();
				context.moveTo(source.x, source.y);
				context.lineTo(target.x, target.y);
				context.stroke();
			}

			for (const node of nodes) {
				const isActive = node.id === active?.id;
				const isNeighbor = connectedToActive.has(node.id);
				const isMatched = hasHighlight && highlight.has(node.id);
				const score = scores.get(node.id) ?? 0;
				const isDimmed = hasHighlight
					? !isMatched && !isActive
					: Boolean(active) && !isActive && !isNeighbor;
				const emphasize = isActive || isMatched;
				const matchScale = isMatched ? 1 + score * 0.8 : 1;
				const radius =
					((compact ? 6 : 8) + Math.min(6, node.degree * 0.28)) * matchScale;
				const color =
					node.member.member_status === "alumni"
						? colors.nodeMuted
						: colors.node;
				const haloAlpha = isDimmed ? 0.05 : emphasize ? 0.34 : 0.16;
				drawHalo(
					node.x,
					node.y,
					radius * (emphasize ? 4.4 : 3),
					color,
					haloAlpha,
				);

				context.save();
				context.globalAlpha = isDimmed ? 0.22 : 1;
				context.shadowColor = color;
				context.shadowBlur = emphasize ? 16 : 7;
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

				const showLabel =
					emphasize ||
					(!active && !hasHighlight && node.degree > 0 && !compact);
				if (showLabel) {
					context.globalAlpha = isDimmed ? 0.4 : 1;
					context.fillStyle = emphasize ? colors.text : colors.textSecondary;
					context.font = `${emphasize ? 700 : 600} 12px Manrope, sans-serif`;
					context.textAlign = "center";
					context.textBaseline = "top";
					context.fillText(
						node.label.split(" ")[0],
						node.x,
						node.y + radius + 8,
					);
					context.globalAlpha = 1;
				}
			}

			raf = window.requestAnimationFrame(draw);
		}

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(container);
		raf = window.requestAnimationFrame(draw);

		return () => {
			window.cancelAnimationFrame(raf);
			resizeObserver.disconnect();
		};
	}, [compact, resolvedTheme]);

	function handlePointerMove(
		event: ReactPointerEvent<HTMLCanvasElement>,
	): void {
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
		(containerRef.current?.clientWidth ?? 900) - 320,
	);
	const tooltipTop = Math.min(
		Math.max(16, hoverPoint.y + 18),
		(containerRef.current?.clientHeight ?? 620) - 220,
	);

	return (
		<div
			ref={containerRef}
			className="relative h-[440px] overflow-hidden rounded-xl border bg-card md:h-[560px]"
		>
			<canvas
				ref={canvasRef}
				aria-label="Member expertise graph visualization"
				role="img"
				onPointerMove={handlePointerMove}
				onPointerDown={handlePointerDown}
				onPointerLeave={() => setHoveredId(null)}
				className="block"
				style={{ cursor: hoveredNode ? "pointer" : "default" }}
			/>

			{hoveredNode && (
				<div
					className="pointer-events-none absolute z-10 w-80 max-w-[calc(100%-2rem)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg"
					style={{ left: tooltipLeft, top: tooltipTop }}
				>
					<p className="font-bold">{hoveredNode.label}</p>
					{hoveredNode.subtitle && (
						<p className="mt-0.5 text-sm text-muted-foreground">
							{hoveredNode.subtitle}
						</p>
					)}
					<p className="mt-3 mb-1.5 text-xs text-muted-foreground">
						Grouped with
					</p>
					<div className="space-y-1.5">
						{hoverConnections.slice(0, 5).map(({ neighbor, edge }) => (
							<div key={edge.id}>
								<p className="text-sm font-semibold">{neighbor.label}</p>
								<p className="text-xs text-muted-foreground">
									{getReasonSummary(edge)}
								</p>
							</div>
						))}
						{hoverConnections.length === 0 && (
							<p className="text-sm text-muted-foreground">
								No shared selected attributes.
							</p>
						)}
						{hoverConnections.length > 5 && (
							<p className="text-xs text-muted-foreground">
								+{hoverConnections.length - 5} more connections
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
