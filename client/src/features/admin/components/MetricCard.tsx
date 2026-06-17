import type { ReactNode } from "react";
import { InfoBox } from "@/components/ui/info-box";

interface MetricCardProps {
	icon: ReactNode;
	label: string;
	value: number;
}

export function MetricCard({ icon, label, value }: MetricCardProps) {
	return (
		<InfoBox variant="brand" className="flex items-center gap-3 p-4">
			<div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
				{icon}
			</div>
			<div>
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="text-2xl font-semibold">{value}</p>
			</div>
		</InfoBox>
	);
}
