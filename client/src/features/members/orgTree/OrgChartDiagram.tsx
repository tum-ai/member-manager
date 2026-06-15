import { OrgChart } from "d3-org-chart";
import {
	ChevronsDownUp,
	ChevronsUpDown,
	Download,
	Maximize2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { OrgTreeNode } from "./orgTreeData";
import {
	getNodeSize,
	renderButtonContent,
	renderNodeContent,
} from "./orgTreeNodeContent";
import "./org-chart.css";

interface OrgChartDiagramProps {
	nodes: OrgTreeNode[];
}

// d3-org-chart reads/writes an `_expanded` flag on each datum. Flagging every
// node except member leaves reveals the tree down to departments while keeping
// each department's members collapsed until the user expands them — and works
// whether or not a Presidency node sits between root and the departments.
type ChartDatum = OrgTreeNode & { _expanded?: boolean };

// Tailwind's `sm` breakpoint. Below it we treat the layout as mobile.
const MOBILE_BREAKPOINT = 640;

export default function OrgChartDiagram({ nodes }: OrgChartDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<OrgChart<ChartDatum> | null>(null);

	// fit() computes its transform from the container's size, so it is a no-op
	// (leaving the tree clipped at native scale) while the container still has
	// zero dimensions — which happens on the first frame on mobile, inside the
	// off-canvas sidebar layout. Only fit once the container is actually sized.
	//
	// On wide screens we fit the whole tree to the viewport. On narrow screens
	// fitting the full department row scales it to ~12% — unreadable — so we
	// center it at natural size instead (`scale: false`) and let the user
	// pan/zoom to explore.
	const fitChart = useCallback(() => {
		const container = containerRef.current;
		const chart = chartRef.current;
		if (
			!chart ||
			!container ||
			container.clientWidth === 0 ||
			container.clientHeight === 0
		)
			return;
		chart.fit({ scale: container.clientWidth >= MOBILE_BREAKPOINT });
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const chart = chartRef.current ?? new OrgChart<ChartDatum>();
		chartRef.current = chart;

		const data: ChartDatum[] = nodes.map((node) => ({
			...node,
			_expanded: !node.id.startsWith("member:"),
		}));

		chart
			.container(container)
			.data(data)
			.nodeWidth((d) => getNodeSize(d.data).width)
			.nodeHeight((d) => getNodeSize(d.data).height)
			.childrenMargin(() => 70)
			.siblingsMargin(() => 32)
			.neighbourMargin(() => 60)
			.compact(false)
			.layout("top")
			.setActiveNodeCentered(true)
			.duration(350)
			.nodeContent((d) => renderNodeContent(d.data))
			.buttonContent((params) => renderButtonContent(params))
			.render();

		// Fit once layout is measured. The container can still be 0-sized on the
		// first frame (mobile, off-canvas sidebar), so retry across a few frames
		// until it has real dimensions instead of fitting against a 0 viewport.
		let frame = 0;
		let attempts = 0;
		const tryFit = () => {
			const el = containerRef.current;
			if (el && el.clientWidth > 0 && el.clientHeight > 0) {
				fitChart();
			} else if (attempts++ < 30) {
				frame = requestAnimationFrame(tryFit);
			}
		};
		frame = requestAnimationFrame(tryFit);
		return () => cancelAnimationFrame(frame);
	}, [nodes, fitChart]);

	// Re-fit on container resize (sidebar toggle, window resize, mobile address
	// bar). render() keeps each datum's `_expanded` state, so user expansions
	// survive the re-layout. We act on the first real measurement too — skipping
	// it (as before) meant the chart never fit on mobile, where the meaningful
	// size only arrives after mount.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") return;

		let frame = 0;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width === 0) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				chartRef.current?.render();
				fitChart();
			});
		});
		observer.observe(container);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [fitChart]);

	// d3-org-chart owns the container's DOM subtree; clear it on unmount.
	useEffect(() => {
		return () => {
			const container = containerRef.current;
			if (container) container.innerHTML = "";
			chartRef.current = null;
		};
	}, []);

	const controls: {
		label: string;
		icon: typeof ZoomIn;
		action: () => void;
	}[] = [
		{
			label: "Zoom in",
			icon: ZoomIn,
			action: () => chartRef.current?.zoomIn(),
		},
		{
			label: "Zoom out",
			icon: ZoomOut,
			action: () => chartRef.current?.zoomOut(),
		},
		{
			label: "Fit to screen",
			icon: Maximize2,
			action: fitChart,
		},
		{
			label: "Expand all",
			icon: ChevronsUpDown,
			action: () => {
				chartRef.current?.expandAll();
				fitChart();
			},
		},
		{
			label: "Collapse all",
			icon: ChevronsDownUp,
			action: () => {
				chartRef.current?.collapseAll();
				fitChart();
			},
		},
		{
			label: "Export PNG",
			icon: Download,
			action: () => chartRef.current?.exportImg({ full: true }),
		},
	];

	return (
		<div className="relative h-[calc(100vh-13rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card">
			<div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-card/80 p-1 shadow-sm backdrop-blur">
				{controls.map(({ label, icon: Icon, action }) => (
					<Button
						key={label}
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						title={label}
						onClick={action}
					>
						<Icon />
					</Button>
				))}
			</div>
			<div ref={containerRef} className="org-tree size-full" />
		</div>
	);
}
