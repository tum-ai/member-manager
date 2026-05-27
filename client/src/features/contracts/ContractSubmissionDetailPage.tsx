import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ToolPageShell from "../tools/ToolPageShell";
import {
	useContractSubmission,
	useUpdateContractSubmission,
} from "./useContracts";

export default function ContractSubmissionDetailPage(): JSX.Element {
	const { id } = useParams<{ id: string }>();
	const submissionQuery = useContractSubmission(id);
	const updateMutation = useUpdateContractSubmission(id ?? "");

	const [editedText, setEditedText] = useState("");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		const data = submissionQuery.data;
		if (data) {
			setEditedText(
				data.admin_edited_text ?? data.generated_contract_text ?? "",
			);
			setNotes(data.notes ?? "");
		}
	}, [submissionQuery.data]);

	if (submissionQuery.isLoading) return <CircularProgress />;
	if (submissionQuery.error)
		return (
			<Alert severity="error">{(submissionQuery.error as Error).message}</Alert>
		);
	const submission = submissionQuery.data;
	if (!submission) return <Alert severity="warning">Not found</Alert>;

	const signUrl = submission.signature_token
		? `${window.location.origin}/contracts/sign/${submission.signature_token}`
		: null;

	return (
		<ToolPageShell
			title={`Submission ${submission.id.slice(0, 8)}…`}
			description={`Status: ${submission.status}`}
		>
			<Stack spacing={3}>
				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Form Data
					</Typography>
					<Box
						component="pre"
						sx={{
							whiteSpace: "pre-wrap",
							fontFamily: "monospace",
							fontSize: 13,
							m: 0,
						}}
					>
						{JSON.stringify(submission.form_data, null, 2)}
					</Box>
				</Paper>

				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Contract Text (Editable)
					</Typography>
					<TextField
						multiline
						minRows={14}
						fullWidth
						value={editedText}
						onChange={(event) => setEditedText(event.target.value)}
						sx={{ fontFamily: "monospace" }}
					/>
					<TextField
						label="Internal Notes"
						multiline
						minRows={2}
						fullWidth
						value={notes}
						onChange={(event) => setNotes(event.target.value)}
						sx={{ mt: 2 }}
					/>
				</Paper>

				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Actions
					</Typography>
					<Stack direction="row" spacing={1} flexWrap="wrap">
						<Button
							variant="outlined"
							disabled={updateMutation.isPending}
							onClick={() =>
								updateMutation.mutate({
									admin_edited_text: editedText,
									notes,
								})
							}
						>
							Save Changes
						</Button>
						<Button
							variant="contained"
							color="success"
							disabled={updateMutation.isPending}
							onClick={() =>
								updateMutation.mutate({
									status: "approved",
									admin_edited_text: editedText,
									notes,
									generate_signature_token: true,
								})
							}
						>
							Approve + Generate Signing Link
						</Button>
						<Button
							variant="outlined"
							color="warning"
							disabled={updateMutation.isPending}
							onClick={() =>
								updateMutation.mutate({
									status: "inquiry",
									notes,
								})
							}
						>
							Request Clarification
						</Button>
						<Button
							variant="outlined"
							color="error"
							disabled={updateMutation.isPending}
							onClick={() =>
								updateMutation.mutate({
									status: "rejected",
									notes,
								})
							}
						>
							Reject
						</Button>
					</Stack>
					{updateMutation.error ? (
						<Alert severity="error" sx={{ mt: 2 }}>
							{(updateMutation.error as Error).message}
						</Alert>
					) : null}
					{signUrl ? (
						<Box sx={{ mt: 2 }}>
							<Typography variant="caption" color="text.secondary">
								Signing link (send to partner):
							</Typography>
							<TextField
								value={signUrl}
								fullWidth
								size="small"
								InputProps={{ readOnly: true }}
							/>
						</Box>
					) : null}
				</Paper>
			</Stack>
		</ToolPageShell>
	);
}
