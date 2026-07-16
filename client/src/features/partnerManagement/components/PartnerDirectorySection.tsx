import type { ManagedPartner, PartnerStatus } from "@member-manager/shared";
import { Archive, MailPlus, Pencil, Plus, Search } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	formatContractRange,
	PARTNER_STATUS_LABELS,
	type PartnerStatusFilter,
	partnerKindLabel,
} from "@/features/partnerManagement/partnerManagementUtils";

const STATUS_VARIANTS: Record<PartnerStatus, BadgeVariant> = {
	invited: "warning",
	active: "success",
	expired: "danger",
	archived: "neutral",
};

interface PartnerDirectorySectionProps {
	partners: ManagedPartner[];
	totalCount: number;
	searchTerm: string;
	onSearchTermChange: (value: string) => void;
	statusFilter: PartnerStatusFilter;
	onStatusFilterChange: (value: PartnerStatusFilter) => void;
	onCreate: () => void;
	onEdit: (partner: ManagedPartner) => void;
	onActivationLink: (partner: ManagedPartner) => void;
	onArchive: (partner: ManagedPartner) => void;
	isGeneratingActivationLink: boolean;
}

function ActionButton({
	label,
	onClick,
	children,
	disabled = false,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					size="icon-sm"
					variant="ghost"
					aria-label={label}
					onClick={onClick}
					disabled={disabled}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function PartnerActions({
	partner,
	onEdit,
	onActivationLink,
	onArchive,
	isGeneratingActivationLink,
}: Pick<
	PartnerDirectorySectionProps,
	"onEdit" | "onActivationLink" | "onArchive" | "isGeneratingActivationLink"
> & { partner: ManagedPartner }) {
	return (
		<TooltipProvider>
			<div className="flex items-center justify-end gap-1">
				<ActionButton
					label={`Edit ${partner.companyName}`}
					onClick={() => onEdit(partner)}
				>
					<Pencil />
				</ActionButton>
				{partner.status === "invited" && (
					<ActionButton
						label={`Generate activation link for ${partner.companyName}`}
						onClick={() => onActivationLink(partner)}
						disabled={isGeneratingActivationLink}
					>
						<MailPlus />
					</ActionButton>
				)}
				{partner.status !== "archived" && (
					<ActionButton
						label={`Archive ${partner.companyName}`}
						onClick={() => onArchive(partner)}
					>
						<Archive />
					</ActionButton>
				)}
			</div>
		</TooltipProvider>
	);
}

export function PartnerDirectorySection({
	partners,
	totalCount,
	searchTerm,
	onSearchTermChange,
	statusFilter,
	onStatusFilterChange,
	onCreate,
	onEdit,
	onActivationLink,
	onArchive,
	isGeneratingActivationLink,
}: PartnerDirectorySectionProps) {
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
						<SelectItem value="all">All statuses</SelectItem>
						{Object.entries(PARTNER_STATUS_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
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
				{partners.length} of {totalCount} partners
			</div>

			<div className="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Organization</TableHead>
							<TableHead>Tier</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Contract</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{partners.map((partner) => (
							<TableRow key={partner.id}>
								<TableCell>
									<div className="font-medium">{partner.companyName}</div>
									<div className="text-xs text-muted-foreground">
										{partner.primaryEmail}
									</div>
								</TableCell>
								<TableCell>{partner.tier?.displayName ?? "Unknown"}</TableCell>
								<TableCell>{partnerKindLabel(partner.partnerKind)}</TableCell>
								<TableCell>
									{formatContractRange(
										partner.contractStart,
										partner.contractEnd,
									)}
								</TableCell>
								<TableCell>
									<Badge variant={STATUS_VARIANTS[partner.status]}>
										{PARTNER_STATUS_LABELS[partner.status]}
									</Badge>
								</TableCell>
								<TableCell>
									<PartnerActions
										partner={partner}
										onEdit={onEdit}
										onActivationLink={onActivationLink}
										onArchive={onArchive}
										isGeneratingActivationLink={isGeneratingActivationLink}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="divide-y md:hidden">
				{partners.map((partner) => (
					<div key={partner.id} className="space-y-3 p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="truncate font-medium">
									{partner.companyName}
								</div>
								<div className="truncate text-xs text-muted-foreground">
									{partner.primaryEmail}
								</div>
							</div>
							<Badge variant={STATUS_VARIANTS[partner.status]}>
								{PARTNER_STATUS_LABELS[partner.status]}
							</Badge>
						</div>
						<dl className="grid grid-cols-2 gap-2 text-sm">
							<div>
								<dt className="text-xs text-muted-foreground">Tier</dt>
								<dd>{partner.tier?.displayName ?? "Unknown"}</dd>
							</div>
							<div>
								<dt className="text-xs text-muted-foreground">Type</dt>
								<dd>{partnerKindLabel(partner.partnerKind)}</dd>
							</div>
							<div className="col-span-2">
								<dt className="text-xs text-muted-foreground">Contract</dt>
								<dd>
									{formatContractRange(
										partner.contractStart,
										partner.contractEnd,
									)}
								</dd>
							</div>
						</dl>
						<PartnerActions
							partner={partner}
							onEdit={onEdit}
							onActivationLink={onActivationLink}
							onArchive={onArchive}
							isGeneratingActivationLink={isGeneratingActivationLink}
						/>
					</div>
				))}
			</div>

			{partners.length === 0 && (
				<div className="px-4 py-12 text-center text-sm text-muted-foreground">
					No partners match the current filters.
				</div>
			)}
		</section>
	);
}
