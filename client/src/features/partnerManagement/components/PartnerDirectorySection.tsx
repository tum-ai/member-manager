import type { ManagedPartner } from "@member-manager/shared";
import { Archive, ChevronDown, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	PARTNER_STATUS_LABELS,
	type PartnerStatusFilter,
} from "@/features/partnerManagement/partnerManagementUtils";
import {
	type PartnerDirectoryActions,
	PartnerDirectoryTable,
} from "./PartnerDirectoryTable";

interface PartnerDirectorySectionProps extends PartnerDirectoryActions {
	partners: ManagedPartner[];
	archivedPartners: ManagedPartner[];
	totalCount: number;
	searchTerm: string;
	onSearchTermChange: (value: string) => void;
	statusFilter: PartnerStatusFilter;
	onStatusFilterChange: (value: PartnerStatusFilter) => void;
	onCreate: () => void;
}

const FILTERABLE_STATUSES = ["invited", "active", "expired"] as const;

export function PartnerDirectorySection({
	partners,
	archivedPartners,
	totalCount,
	searchTerm,
	onSearchTermChange,
	statusFilter,
	onStatusFilterChange,
	onCreate,
	...actions
}: PartnerDirectorySectionProps) {
	const [archivedOpen, setArchivedOpen] = useState(false);

	return (
		<section className="overflow-hidden rounded-lg border bg-card">
			<div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
				<div className="relative min-w-0 flex-1">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						aria-label="Search partners"
						value={searchTerm}
						onChange={(event) => onSearchTermChange(event.target.value)}
						placeholder="Search company, email, or tier"
						className="pl-9"
					/>
				</div>
				<Select
					value={statusFilter}
					onValueChange={(value) =>
						onStatusFilterChange(value as PartnerStatusFilter)
					}
				>
					<SelectTrigger
						className="w-full sm:w-48"
						aria-label="Filter by status"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All current statuses</SelectItem>
						{FILTERABLE_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{PARTNER_STATUS_LABELS[value]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					className="bg-[#9A64D9] text-white hover:bg-[#523573]"
					onClick={onCreate}
				>
					<Plus />
					Add partner
				</Button>
			</div>

			<div className="border-b px-4 py-2 text-xs text-muted-foreground">
				{partners.length} of {totalCount} current partners
			</div>

			{partners.length > 0 ? (
				<PartnerDirectoryTable partners={partners} {...actions} />
			) : (
				<div className="px-4 py-12 text-center text-sm text-muted-foreground">
					No current partners match the filters.
				</div>
			)}

			{archivedPartners.length > 0 && (
				<Collapsible
					open={archivedOpen}
					onOpenChange={setArchivedOpen}
					className="border-t"
				>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							className="group h-11 w-full justify-start rounded-none px-4 text-muted-foreground"
						>
							<Archive />
							Archived partners
							<Badge variant="neutral">{archivedPartners.length}</Badge>
							<ChevronDown className="ml-auto transition-transform group-data-[state=open]:rotate-180" />
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="border-t bg-muted/20">
						<PartnerDirectoryTable partners={archivedPartners} {...actions} />
					</CollapsibleContent>
				</Collapsible>
			)}
		</section>
	);
}
