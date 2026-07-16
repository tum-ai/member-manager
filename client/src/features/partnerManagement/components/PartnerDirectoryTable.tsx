import type { ManagedPartner, PartnerStatus } from "@member-manager/shared";
import { Archive, BriefcaseBusiness, MailPlus, Pencil } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	partnerKindLabel,
	partnerTierLabel,
} from "@/features/partnerManagement/partnerManagementUtils";

const STATUS_VARIANTS: Record<PartnerStatus, BadgeVariant> = {
	invited: "warning",
	active: "success",
	expired: "danger",
	archived: "neutral",
};

export interface PartnerDirectoryActions {
	onEdit: (partner: ManagedPartner) => void;
	onManageJobs: (partner: ManagedPartner) => void;
	onActivationLink: (partner: ManagedPartner) => void;
	onArchive: (partner: ManagedPartner) => void;
	isGeneratingActivationLink: boolean;
}

interface PartnerDirectoryTableProps extends PartnerDirectoryActions {
	partners: ManagedPartner[];
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
	onManageJobs,
	onActivationLink,
	onArchive,
	isGeneratingActivationLink,
}: PartnerDirectoryActions & { partner: ManagedPartner }) {
	return (
		<TooltipProvider>
			<div className="flex items-center justify-end gap-1">
				<ActionButton
					label={`Manage jobs for ${partner.companyName}`}
					onClick={() => onManageJobs(partner)}
				>
					<BriefcaseBusiness />
				</ActionButton>
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

export function PartnerDirectoryTable({
	partners,
	...actions
}: PartnerDirectoryTableProps) {
	return (
		<>
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Organization</TableHead>
							<TableHead>Package</TableHead>
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
								<TableCell>{partnerTierLabel(partner)}</TableCell>
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
									<PartnerActions partner={partner} {...actions} />
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
								<dt className="text-xs text-muted-foreground">Package</dt>
								<dd>{partnerTierLabel(partner)}</dd>
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
						<PartnerActions partner={partner} {...actions} />
					</div>
				))}
			</div>
		</>
	);
}
