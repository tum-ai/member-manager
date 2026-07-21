import type { ContractWorkflowStatus } from "@member-manager/shared";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { useCurrentUserIsAdmin } from "@/hooks/useCurrentUserIsAdmin";
import {
	CONTRACT_STATUS_LABELS,
	getContractStatusLabel,
	getContractStatusTone,
} from "./contractStatus";
import { useContractSubmissions } from "./hooks/useContractSubmissions";
import { useContractTemplates } from "./hooks/useContractTemplates";

const STATUS_FILTERS: Array<{
	value: ContractWorkflowStatus | "all";
	label: string;
}> = [
	{ value: "all", label: "All" },
	...(Object.keys(CONTRACT_STATUS_LABELS) as ContractWorkflowStatus[]).map(
		(value) => ({ value, label: CONTRACT_STATUS_LABELS[value] }),
	),
];

export default function ContractSubmissionsPage(): JSX.Element {
	const submissionsQuery = useContractSubmissions();
	const templatesQuery = useContractTemplates();
	const { currentUserId, isAdmin } = useCurrentUserIsAdmin();
	const [statusFilter, setStatusFilter] = useState<
		ContractWorkflowStatus | "all"
	>("all");

	const templateNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const template of templatesQuery.data ?? []) {
			map.set(template.id, template.name);
		}
		return map;
	}, [templatesQuery.data]);

	const filtered = useMemo(() => {
		const all = submissionsQuery.data ?? [];
		if (statusFilter === "all") return all;
		return all.filter((submission) => submission.status === statusFilter);
	}, [submissionsQuery.data, statusFilter]);

	return (
		<ToolPageShell title="Contract Submissions">
			<div className="mb-4 flex flex-row items-center justify-end gap-2">
				<Label className="text-muted-foreground" htmlFor="status-filter">
					Status
				</Label>
				<Select
					value={statusFilter}
					onValueChange={(value) =>
						setStatusFilter(value as ContractWorkflowStatus | "all")
					}
				>
					<SelectTrigger
						id="status-filter"
						size="sm"
						className="min-w-[200px]"
						aria-label="Status"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{STATUS_FILTERS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{submissionsQuery.isLoading ? (
				<SkeletonRegion
					label="Loading submissions"
					className="overflow-hidden rounded-xl border bg-card"
				>
					<div className="flex items-center gap-6 border-b bg-muted/40 px-4 py-3">
						{["Contract", "Status", "Submitted", "Signed", "Signing link"].map(
							(col) => (
								<Skeleton key={col} className="h-4 flex-1" />
							),
						)}
					</div>
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							key={i}
							className="flex items-center gap-6 border-b px-4 py-4 last:border-b-0"
						>
							<div className="flex-1 space-y-1.5">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-16" />
							</div>
							<Skeleton className="h-5 w-20 flex-1 rounded-full" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-5 w-16 flex-1 rounded-full" />
						</div>
					))}
				</SkeletonRegion>
			) : submissionsQuery.error ? (
				<Alert variant="destructive">
					<AlertDescription>
						{(submissionsQuery.error as Error).message}
					</AlertDescription>
				</Alert>
			) : (
				<GlassCard variant="elevated" className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Contract</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Submitted</TableHead>
								<TableHead>Signed</TableHead>
								<TableHead>Signing link</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.map((submission) => {
								const to =
									submission.status === "draft" &&
									(submission.submitter_user_id === currentUserId || isAdmin)
										? `/contracts/drafts/${submission.id}`
										: `/contracts/submissions/${submission.id}`;
								return (
									<TableRow key={submission.id}>
										<TableCell>
											<LinkButton asChild className="flex flex-col">
												<RouterLink to={to}>
													<span className="font-medium">
														{templateNames.get(submission.template_id) ??
															"Contract"}
													</span>
													<span className="font-mono text-xs text-muted-foreground">
														{submission.id.slice(0, 8)}…
													</span>
												</RouterLink>
											</LinkButton>
										</TableCell>
										<TableCell>
											<Badge variant={getContractStatusTone(submission.status)}>
												{getContractStatusLabel(submission.status)}
											</Badge>
										</TableCell>
										<TableCell>
											{submission.submitted_at
												? new Date(submission.submitted_at).toLocaleString()
												: "-"}
										</TableCell>
										<TableCell>
											{submission.signed_at
												? new Date(submission.signed_at).toLocaleString()
												: "-"}
										</TableCell>
										<TableCell>
											{submission.signature_token ? (
												<Badge variant="accent">Active</Badge>
											) : (
												"-"
											)}
										</TableCell>
									</TableRow>
								);
							})}
							{filtered.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={5}
										className="py-10 text-center text-muted-foreground"
									>
										No submissions match this filter.
									</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</GlassCard>
			)}
		</ToolPageShell>
	);
}
