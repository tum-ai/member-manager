import {
	MEMBER_GRAPH_REASON_KINDS,
	type MemberGraphReasonKind,
} from "@member-manager/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { REASON_LABELS } from "@/features/members/memberGraphUtils";

export interface MemberGraphStats {
	members: number;
	shownEdges: number;
	logicalEdges: number;
	components: number;
	largestComponent: number;
	isolated: number;
}

interface MemberGraphControlsProps {
	reasonKinds: MemberGraphReasonKind[];
	onReasonKindsChange: (kinds: MemberGraphReasonKind[]) => void;
	showAlumni: boolean;
	onShowAlumniChange: (show: boolean) => void;
	stats: MemberGraphStats;
}

const STAT_LABELS: { key: keyof MemberGraphStats; label: string }[] = [
	{ key: "members", label: "Members" },
	{ key: "shownEdges", label: "Shown edges" },
	{ key: "components", label: "Clusters" },
	{ key: "largestComponent", label: "Largest cluster" },
];

export function MemberGraphControls({
	reasonKinds,
	onReasonKindsChange,
	showAlumni,
	onShowAlumniChange,
	stats,
}: MemberGraphControlsProps): React.ReactElement {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{STAT_LABELS.map((stat) => (
					<div key={stat.key} className="rounded-lg border bg-card px-3 py-2">
						<p className="text-xs text-muted-foreground">{stat.label}</p>
						<p className="mt-0.5 text-xl font-semibold tabular-nums">
							{stats[stat.key]}
						</p>
					</div>
				))}
			</div>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<ToggleGroup
					type="multiple"
					variant="outline"
					value={reasonKinds}
					onValueChange={(next) => {
						// Never let the graph go blank — keep the last reason if all cleared.
						if (next.length > 0) {
							onReasonKindsChange(next as MemberGraphReasonKind[]);
						}
					}}
					aria-label="Graph connection reasons"
					className="flex-wrap"
				>
					{MEMBER_GRAPH_REASON_KINDS.map((kind) => (
						<ToggleGroupItem
							key={kind}
							value={kind}
							aria-label={REASON_LABELS[kind]}
						>
							{REASON_LABELS[kind]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				<div className="flex items-center gap-2">
					<Switch
						id="member-graph-alumni"
						checked={showAlumni}
						onCheckedChange={onShowAlumniChange}
					/>
					<Label htmlFor="member-graph-alumni">Include alumni</Label>
				</div>
			</div>

			<p className="text-xs text-muted-foreground">
				{stats.shownEdges === stats.logicalEdges
					? `Linking members by shared attributes · ${stats.isolated} unconnected`
					: `Showing ${stats.shownEdges} of ${stats.logicalEdges} links (sparsified) · ${stats.isolated} unconnected`}
			</p>
		</div>
	);
}
