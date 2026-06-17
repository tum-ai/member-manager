import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
// A4 content margins, in page coordinates (≈11.9% sides/top, 9.5% bottom).
const PAGE_MARGIN_X = Math.round(PAGE_WIDTH * 0.119);
const PAGE_MARGIN_TOP = Math.round(PAGE_WIDTH * 0.119);
const PAGE_MARGIN_BOTTOM = Math.round(PAGE_WIDTH * 0.095);
// Page fills the full tray width so the document sits flush against the
// container edges.
const PAGE_WIDTH_FRACTION = 1;

interface ContractDocumentPreviewProps {
	pages?: string[];
	loading?: boolean;
	emptyLabel?: string;
	maxHeight?: string | Record<string, string>;
	minHeight?: number | string | Record<string, number | string>;
	// Upper bound for a single page's rendered width. Pages scale to fill the
	// container but never grow wider than this (keeps text legible, not huge).
	pageMaxWidth?: number;
}

function resolveResponsive<T>(
	value: T | Record<string, T> | undefined,
): T | undefined {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, T>;
		const isWide =
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches;
		if (isWide && "lg" in record) return record.lg;
		if ("sm" in record) return record.sm;
		if ("md" in record) return record.md;
		if ("xs" in record) return record.xs;
		const values = Object.values(record);
		return values.length > 0 ? values[0] : undefined;
	}
	return value as T | undefined;
}

// Each line is a fixed 17px box with no element margins — paragraph spacing
// comes solely from the server's blank lines (which are counted in its
// 39-lines-per-page budget). This keeps the rendered page height in lockstep
// with that budget, matching the generated PDF and leaving a real bottom
// margin instead of overflowing it.
const PAGE_LINE_HEIGHT = 17;
const PAGE_STYLE_CSS = `
[data-contract-page] h1 {
	font-size: 20px;
	font-weight: 700;
	letter-spacing: 0;
	line-height: 25px;
	margin: 0;
	text-align: center;
}
[data-contract-page] h2 {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0;
	line-height: ${PAGE_LINE_HEIGHT}px;
	margin: 0;
}
[data-contract-page] p {
	line-height: ${PAGE_LINE_HEIGHT}px;
	margin: 0;
	text-align: justify;
}
[data-contract-page] ul {
	margin: 0;
	padding: 0;
}
[data-contract-page] li {
	line-height: ${PAGE_LINE_HEIGHT}px;
	margin: 0 0 0 0.55cm;
	padding-left: 0.15cm;
	text-align: justify;
}
[data-contract-page] .list-continuation {
	line-height: ${PAGE_LINE_HEIGHT}px;
	margin: 0 0 0 0.55cm;
	padding-left: 0.15cm;
	text-align: justify;
}
[data-contract-page] .blank-line {
	height: ${PAGE_LINE_HEIGHT}px;
	line-height: ${PAGE_LINE_HEIGHT}px;
	margin: 0;
}
`;

export function ContractDocumentPreview({
	pages,
	loading = false,
	emptyLabel = "No preview available",
	maxHeight = { xs: "70vh", lg: "calc(100vh - 220px)" },
	minHeight = 320,
	pageMaxWidth = 620,
}: ContractDocumentPreviewProps): JSX.Element {
	const resolvedMinHeight = resolveResponsive(minHeight);
	const resolvedMaxHeight = resolveResponsive(maxHeight);

	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const update = () => {
			const width = element.clientWidth;
			if (width <= 0) return;
			const target = Math.min(width * PAGE_WIDTH_FRACTION, pageMaxWidth);
			setScale(target / PAGE_WIDTH);
		};
		update();
		const observer = new ResizeObserver(() => update());
		observer.observe(element);
		return () => observer.disconnect();
	}, [pageMaxWidth]);

	if (loading) {
		return (
			<SkeletonRegion
				label="Loading document"
				className="grid min-h-[320px] place-items-center p-6"
			>
				<div className="aspect-[1/1.414] w-full max-w-[595px] space-y-3 rounded-md border bg-card p-8 shadow-sm">
					<Skeleton className="mb-6 h-6 w-1/2" />
					{Array.from({ length: 10 }).map((_, i) => (
						<Skeleton
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							key={i}
							className={i % 4 === 3 ? "h-3 w-2/3" : "h-3 w-full"}
						/>
					))}
				</div>
			</SkeletonRegion>
		);
	}

	const visiblePages = pages && pages.length > 0 ? pages : [];
	if (visiblePages.length === 0) {
		return (
			<div className="grid min-h-[320px] place-items-center p-6 text-center">
				<div className="flex flex-col items-center gap-2 text-muted-foreground">
					<FileText className="size-8 opacity-60" />
					<p className="text-sm">{emptyLabel}</p>
				</div>
			</div>
		);
	}

	const scaledWidth = PAGE_WIDTH * scale;
	const scaledHeight = PAGE_HEIGHT * scale;

	return (
		<div
			ref={containerRef}
			data-contract-preview
			className="overflow-auto"
			style={{
				maxHeight: resolvedMaxHeight,
				minHeight: resolvedMinHeight,
			}}
		>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: scoped print styles for server-generated contract pages. */}
			<style dangerouslySetInnerHTML={{ __html: PAGE_STYLE_CSS }} />
			<div
				className="mx-auto flex flex-col items-center"
				style={{ width: scaledWidth }}
			>
				{visiblePages.map((page, index) => (
					<div key={page} style={{ width: scaledWidth, height: scaledHeight }}>
						<div
							style={{
								backgroundColor: "#fff",
								boxSizing: "border-box",
								// Pages stack seamlessly; a hairline marks the page break
								// (skipped on the last page) instead of a gap.
								boxShadow:
									index < visiblePages.length - 1
										? "inset 0 -1px 0 rgba(13, 2, 20, 0.1)"
										: "none",
								height: PAGE_HEIGHT,
								// A4 margins in page coordinates (11.9% / 9.5% of width).
								// Overflow only clips at the page boundary, so a minor
								// rendering overshoot trims the bottom margin slightly
								// instead of slicing the last line in half.
								overflow: "hidden",
								padding: `${PAGE_MARGIN_TOP}px ${PAGE_MARGIN_X}px ${PAGE_MARGIN_BOTTOM}px`,
								transform: `scale(${scale})`,
								transformOrigin: "top left",
								width: PAGE_WIDTH,
							}}
						>
							<div
								// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated server-side from escaped contract text.
								dangerouslySetInnerHTML={{ __html: page }}
								data-contract-page
								style={{
									color: "#0d0214",
									fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
									fontSize: "11px",
									lineHeight: 1.5,
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
