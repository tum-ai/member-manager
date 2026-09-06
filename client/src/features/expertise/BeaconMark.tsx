import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

// The signature Beacon motif: a brand mark with concentric sweeping rings and a
// soft aurora glow — a lighthouse "scanning" for people.
export function BeaconMark({ className }: { className?: string }): JSX.Element {
	return (
		<div
			className={cn("relative flex items-center justify-center", className)}
			style={{ width: 104, height: 104 }}
		>
			<div className="beacon-aurora absolute inset-0 rounded-full" />
			<div className="beacon-ping-ring" style={{ animationDelay: "0s" }} />
			<div className="beacon-ping-ring" style={{ animationDelay: "1s" }} />
			<div className="beacon-ping-ring" style={{ animationDelay: "2s" }} />
			<div className="beacon-float relative flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-lg shadow-brand/30">
				<Radar className="size-7" />
			</div>
		</div>
	);
}
