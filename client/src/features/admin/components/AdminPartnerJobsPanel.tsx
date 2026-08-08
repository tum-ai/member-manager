import type { ManagedPartner } from "@member-manager/shared";
import { BriefcaseBusiness, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminPartnerJobsPanelProps {
	partners: ManagedPartner[];
	selectedPartnerId: string;
	isLoading: boolean;
	error: Error | null;
	onPartnerChange: (partnerId: string) => void;
	onManageJobs: () => void;
}

export function AdminPartnerJobsPanel({
	partners,
	selectedPartnerId,
	isLoading,
	error,
	onPartnerChange,
	onManageJobs,
}: AdminPartnerJobsPanelProps) {
	if (isLoading) {
		return <Skeleton className="h-24 w-full" />;
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<TriangleAlert />
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>
		);
	}

	if (partners.length === 0) {
		return (
			<p className="py-6 text-sm text-muted-foreground">
				No active partner organizations.
			</p>
		);
	}

	return (
		<div className="flex max-w-2xl flex-col gap-4 py-2 sm:flex-row sm:items-end">
			<Field
				className="min-w-0 flex-1"
				label="Partner organization"
				htmlFor="admin-partner-job-organization"
			>
				<Select value={selectedPartnerId} onValueChange={onPartnerChange}>
					<SelectTrigger id="admin-partner-job-organization" className="w-full">
						<SelectValue placeholder="Select a partner" />
					</SelectTrigger>
					<SelectContent>
						{partners.map((partner) => (
							<SelectItem key={partner.id} value={partner.id}>
								{partner.companyName}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Button
				type="button"
				className="bg-[#9A64D9] text-white hover:bg-[#523573]"
				disabled={!selectedPartnerId}
				onClick={onManageJobs}
			>
				<BriefcaseBusiness className="size-4" />
				Manage jobs
			</Button>
		</div>
	);
}
