import { Landmark, Shield, ShieldCheck, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricCard } from "./MetricCard";

interface AdminWorkspaceHeaderProps {
	stats: {
		total: number;
		active: number;
		sepaAccepted: number;
		privacyAccepted: number;
	};
}

export function AdminWorkspaceHeader({ stats }: AdminWorkspaceHeaderProps) {
	return (
		<GlassCard variant="elevated" className="mb-8 overflow-hidden">
			<div className="p-6 md:p-8">
				<div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
					<div className="max-w-[680px]">
						<h1 className="mb-2.5 text-3xl font-bold">Admin Workspace</h1>
						<p className="text-muted-foreground">
							Review membership records, agreement status, and banking data.
						</p>
					</div>
				</div>

				<div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						icon={<Users className="size-4" />}
						label="Total members"
						value={stats.total}
					/>
					<MetricCard
						icon={<ShieldCheck className="size-4" />}
						label="Active members"
						value={stats.active}
					/>
					<MetricCard
						icon={<Landmark className="size-4" />}
						label="SEPA accepted"
						value={stats.sepaAccepted}
					/>
					<MetricCard
						icon={<Shield className="size-4" />}
						label="Privacy accepted"
						value={stats.privacyAccepted}
					/>
				</div>
			</div>
		</GlassCard>
	);
}
