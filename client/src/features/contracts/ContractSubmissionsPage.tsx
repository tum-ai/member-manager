import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import GlassCard from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useCurrentUserIsAdmin } from "../../hooks/useCurrentUserIsAdmin";
import ToolPageShell from "../tools/ToolPageShell";
import {
	CONTRACT_STATUS_LABELS,
	getContractStatusLabel,
	getContractStatusTone,
} from "./contractStatus";
import {
	type ContractSubmissionStatus,
	useContractSubmissions,
	useContractTemplates,
} from "./useContracts";

const STATUS_FILTERS: Array<{
	value: ContractSubmissionStatus | "all";
	label: string;
}> = [
	{ value: "all", label: "All" },
	...(Object.keys(CONTRACT_STATUS_LABELS) as ContractSubmissionStatus[]).map(
		(value) => ({ value, label: CONTRACT_STATUS_LABELS[value] }),
	),
];

export default function ContractSubmissionsPage(): JSX.Element {
	const submissionsQuery = useContractSubmissions();
	const templatesQuery = useContractTemplates();
	const { currentUserId, isAdmin } = useCurrentUserIsAdmin();
	const [statusFilter, setStatusFilter] = useState<
		ContractSubmissionStatus | "all"
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
						setStatusFilter(value as ContractSubmissionStatus | "all")
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
				<Spinner />
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
											<RouterLink
												className="flex flex-col text-brand hover:underline"
												to={to}
											>
												<span className="font-medium">
													{templateNames.get(submission.template_id) ??
														"Contract"}
												</span>
												<span className="font-mono text-xs text-muted-foreground">
													{submission.id.slice(0, 8)}…
												</span>
											</RouterLink>
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
