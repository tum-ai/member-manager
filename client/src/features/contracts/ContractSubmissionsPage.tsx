import {
	Alert,
	Chip,
	CircularProgress,
	MenuItem,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TextField,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCurrentUserIsAdmin } from "../../hooks/useCurrentUserIsAdmin";
import ToolPageShell from "../tools/ToolPageShell";
import {
	type ContractSubmissionStatus,
	useContractSubmissions,
} from "./useContracts";

const STATUS_FILTERS: Array<{
	value: ContractSubmissionStatus | "all";
	label: string;
}> = [
	{ value: "all", label: "All" },
	{ value: "draft", label: "Draft" },
	{ value: "submitted", label: "Submitted" },
	{ value: "legal_review", label: "Legal Review" },
	{ value: "in_review", label: "In Review" },
	{ value: "approved", label: "Approved" },
	{ value: "sent_to_partner", label: "Sent to Partner" },
	{ value: "partner_comments", label: "Partner Comments" },
	{ value: "partner_signed", label: "Partner Signed" },
	{ value: "board_signed", label: "Board Signed" },
	{ value: "rejected", label: "Rejected" },
	{ value: "inquiry", label: "Inquiry" },
	{ value: "signed", label: "Signed" },
	{ value: "completed", label: "Completed" },
];

const STATUS_COLOR: Record<
	ContractSubmissionStatus,
	"default" | "primary" | "success" | "warning" | "error" | "info"
> = {
	draft: "default",
	submitted: "info",
	legal_review: "info",
	in_review: "info",
	approved: "primary",
	sent_to_partner: "primary",
	partner_comments: "warning",
	partner_signed: "success",
	board_signed: "success",
	rejected: "error",
	inquiry: "warning",
	signed: "success",
	completed: "success",
};

export default function ContractSubmissionsPage(): JSX.Element {
	const submissionsQuery = useContractSubmissions();
	const { currentUserId, isAdmin } = useCurrentUserIsAdmin();
	const [statusFilter, setStatusFilter] = useState<
		ContractSubmissionStatus | "all"
	>("all");

	const filtered = useMemo(() => {
		const all = submissionsQuery.data ?? [];
		if (statusFilter === "all") return all;
		return all.filter((submission) => submission.status === statusFilter);
	}, [submissionsQuery.data, statusFilter]);

	return (
		<ToolPageShell title="Contract Submissions">
			<Stack
				direction="row"
				alignItems="center"
				justifyContent="flex-end"
				mb={2}
			>
				<TextField
					select
					size="small"
					label="Status"
					value={statusFilter}
					onChange={(event) =>
						setStatusFilter(
							event.target.value as ContractSubmissionStatus | "all",
						)
					}
					sx={{ minWidth: 200 }}
				>
					{STATUS_FILTERS.map((option) => (
						<MenuItem key={option.value} value={option.value}>
							{option.label}
						</MenuItem>
					))}
				</TextField>
			</Stack>

			{submissionsQuery.isLoading ? (
				<CircularProgress />
			) : submissionsQuery.error ? (
				<Alert severity="error">
					{(submissionsQuery.error as Error).message}
				</Alert>
			) : (
				<Paper>
					<Table>
						<TableHead>
							<TableRow>
								<TableCell>ID</TableCell>
								<TableCell>Status</TableCell>
								<TableCell>Submitted At</TableCell>
								<TableCell>Signed At</TableCell>
								<TableCell>Signing Link</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{filtered.map((submission) => (
								<TableRow key={submission.id} hover>
									<TableCell>
										<RouterLink
											to={
												submission.status === "draft" &&
												(submission.submitter_user_id === currentUserId ||
													isAdmin)
													? `/contracts/drafts/${submission.id}`
													: `/contracts/submissions/${submission.id}`
											}
										>
											{submission.id.slice(0, 8)}…
										</RouterLink>
									</TableCell>
									<TableCell>
										<Chip
											size="small"
											label={submission.status}
											color={STATUS_COLOR[submission.status]}
										/>
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
											<Chip size="small" label="active" color="primary" />
										) : (
											"-"
										)}
									</TableCell>
								</TableRow>
							))}
							{filtered.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} align="center">
										No submissions.
									</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</Paper>
			)}
		</ToolPageShell>
	);
}
