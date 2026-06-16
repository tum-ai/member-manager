// Minimal ambient declaration for d3-org-chart 3.x — the package ships no
// TypeScript definitions. Only the chainable builder methods we actually use
// are typed; everything else falls through `any`.
declare module "d3-org-chart" {
	interface ButtonContentParams<Datum> {
		node: {
			children?: unknown[];
			data: Datum & { _directSubordinatesPaging?: number };
		};
		state: { layout: string };
	}

	export class OrgChart<Datum = unknown> {
		container(selector: string | HTMLElement | null): this;
		data(value: Datum[]): this;
		data(): Datum[];
		nodeWidth(fn: (node: { data: Datum }) => number): this;
		nodeHeight(fn: (node: { data: Datum }) => number): this;
		childrenMargin(fn: (node: { data: Datum }) => number): this;
		siblingsMargin(fn: (node: { data: Datum }) => number): this;
		neighbourMargin(fn: (n1: unknown, n2: unknown) => number): this;
		compact(value: boolean): this;
		layout(value: "top" | "bottom" | "left" | "right"): this;
		initialExpandLevel(value: number): this;
		setActiveNodeCentered(value: boolean): this;
		duration(value: number): this;
		svgHeight(value: number): this;
		scaleExtent(value: [number, number]): this;
		nodeContent(
			fn: (
				d: { data: Datum },
				i: number,
				arr: unknown[],
				state: unknown,
			) => string,
		): this;
		buttonContent(fn: (params: ButtonContentParams<Datum>) => string): this;
		linkUpdate(
			fn: (this: SVGPathElement, d: unknown, i: number, arr: unknown[]) => void,
		): this;
		nodeUpdate(
			fn: (this: SVGGElement, d: unknown, i: number, arr: unknown[]) => void,
		): this;
		onNodeClick(fn: (id: string) => void): this;
		render(): this;
		fit(opts?: { animate?: boolean; scale?: boolean }): this;
		expandAll(): this;
		collapseAll(): this;
		zoomIn(): this;
		zoomOut(): this;
		exportImg(opts?: {
			full?: boolean;
			scale?: number;
			save?: boolean;
			backgroundColor?: string;
		}): this;
		exportSvg(): this;
		setExpanded(id: string, flag?: boolean): this;
	}
}
