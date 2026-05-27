import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
	if (!submission) return <Alert severity="warning">Nicht gefunden</Alert>;

	const signUrl = submission.signature_token
		? `${window.location.origin}/contracts/sign/${submission.signature_token}`
		: null;

	return (
		<Box sx={{ p: 3 }}>
			<Stack direction="row" alignItems="center" spacing={2} mb={2}>
				<Typography variant="h5">
					Einreichung {submission.id.slice(0, 8)}…
				</Typography>
				<Chip label={submission.status} />
			</Stack>

			<Stack spacing={3}>
				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Formulardaten
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
						Vertragstext (editierbar)
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
						label="Interne Notizen"
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
						Aktionen
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
							Änderungen speichern
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
							Freigeben + Signing-Link erzeugen
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
							Rückfrage stellen
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
							Ablehnen
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
								Signing-Link (an Partner senden):
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
		</Box>
	);
}
