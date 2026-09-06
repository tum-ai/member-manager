import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
	/** 0..1 — fraction of the ring to fill (animated). */
	value: number;
	size?: number;
	stroke?: number;
	className?: string;
	/** Rendered centered inside the ring (e.g. initials / avatar). */
	children?: ReactNode;
}

// A thin circular progress ring that frames its children. Colour shifts with
// strength so a strong match reads instantly. Used as the avatar frame on
// person result cards.
export function ScoreRing({
	value,
	size = 48,
	stroke = 3,
	className,
	children,
}: ScoreRingProps): JSX.Element {
	const v = Math.max(0, Math.min(1, value));
	const r = (size - stroke) / 2;
	const circumference = 2 * Math.PI * r;
	const offset = circumference * (1 - v);
	const color =
		v >= 0.66
			? "var(--brand)"
			: v >= 0.33
				? "color-mix(in oklab, var(--brand) 60%, var(--muted-foreground))"
				: "var(--muted-foreground)";

	return (
		<div
			className={cn(
				"relative inline-flex items-center justify-center",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				className="-rotate-90"
				aria-hidden="true"
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="var(--border)"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={color}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					style={{
						transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)",
					}}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				{children}
			</div>
		</div>
	);
}
