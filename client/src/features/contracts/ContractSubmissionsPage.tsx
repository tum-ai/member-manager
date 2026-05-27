import {
	Alert,
	Box,
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
	Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
	type ContractSubmissionStatus,
	useContractSubmissions,
} from "./useContracts";

const STATUS_FILTERS: Array<{
	value: ContractSubmissionStatus | "all";
	label: string;
}> = [
	{ value: "all", label: "Alle" },
	{ value: "submitted", label: "Eingereicht" },
	{ value: "in_review", label: "In Review" },
	{ value: "approved", label: "Freigegeben" },
	{ value: "rejected", label: "Abgelehnt" },
	{ value: "inquiry", label: "Rückfrage" },
	{ value: "signed", label: "Unterzeichnet" },
	{ value: "completed", label: "Abgeschlossen" },
	{ value: "draft", label: "Entwurf" },
];

const STATUS_COLOR: Record<
	ContractSubmissionStatus,
	"default" | "primary" | "success" | "warning" | "error" | "info"
> = {
	draft: "default",
	submitted: "info",
	in_review: "info",
	approved: "primary",
	rejected: "error",
	inquiry: "warning",
	signed: "success",
	completed: "success",
};

export default function ContractSubmissionsPage(): JSX.Element {
	const submissionsQuery = useContractSubmissions();
	const [statusFilter, setStatusFilter] = useState<
		ContractSubmissionStatus | "all"
	>("all");

	const filtered = useMemo(() => {
		const all = submissionsQuery.data ?? [];
		if (statusFilter === "all") return all;
		return all.filter((submission) => submission.status === statusFilter);
	}, [submissionsQuery.data, statusFilter]);

	return (
		<Box sx={{ p: 3 }}>
			<Stack
				direction="row"
				alignItems="center"
				justifyContent="space-between"
				mb={2}
			>
				<Typography variant="h5">Vertragseinreichungen</Typography>
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
								<TableCell>Eingereicht am</TableCell>
								<TableCell>Unterzeichnet am</TableCell>
								<TableCell>Signing-Link</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{filtered.map((submission) => (
								<TableRow key={submission.id} hover>
									<TableCell>
										<RouterLink to={`/contracts/submissions/${submission.id}`}>
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
											<Chip size="small" label="aktiv" color="primary" />
										) : (
											"-"
										)}
									</TableCell>
								</TableRow>
							))}
							{filtered.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} align="center">
										Keine Einreichungen.
									</TableCell>
								</TableRow>
							) : null}
						</TableBody>
					</Table>
				</Paper>
			)}
		</Box>
	);
}
