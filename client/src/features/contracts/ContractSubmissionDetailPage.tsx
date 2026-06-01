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
import ContractDocumentPreview from "./ContractDocumentPreview";
import SignaturePad from "./SignaturePad";
import {
	useBoardSignContractSubmission,
	useContractSubmission,
	useContractSubmissionPreview,
	useFinalizeContractSubmission,
	useUpdateContractSubmission,
} from "./useContracts";

export default function ContractSubmissionDetailPage(): JSX.Element {
	const { id } = useParams<{ id: string }>();
	const submissionQuery = useContractSubmission(id);
	const updateMutation = useUpdateContractSubmission(id ?? "");
	const boardSignMutation = useBoardSignContractSubmission(id ?? "");
	const finalizeMutation = useFinalizeContractSubmission(id ?? "");

	const [editedText, setEditedText] = useState("");
	const [notes, setNotes] = useState("");
	const [boardSignatureData, setBoardSignatureData] = useState<string | null>(
		null,
	);
	const [boardSignerName, setBoardSignerName] = useState("");
	const previewQuery = useContractSubmissionPreview(id, editedText);

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
	const finalPdfUrl = submission.final_pdf_token
		? `${window.location.origin}/api/contracts/final/${submission.final_pdf_token}/pdf`
		: null;
	const busy =
		updateMutation.isPending ||
		boardSignMutation.isPending ||
		finalizeMutation.isPending;
	const actionError =
		updateMutation.error ?? boardSignMutation.error ?? finalizeMutation.error;

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

				{submission.partner_comment ? (
					<Paper sx={{ p: 3 }}>
						<Typography variant="subtitle1" gutterBottom>
							Partner Comments
						</Typography>
						<Typography sx={{ whiteSpace: "pre-wrap" }}>
							{submission.partner_comment}
						</Typography>
					</Paper>
				) : null}

				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Contract Text (Editable)
					</Typography>
					<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
						<Box sx={{ flex: 1, minWidth: 320 }}>
							<TextField
								multiline
								minRows={18}
								fullWidth
								value={editedText}
								onChange={(event) => setEditedText(event.target.value)}
								sx={{ fontFamily: "monospace" }}
							/>
						</Box>
						<Box sx={{ flex: 1, minWidth: 320 }}>
							<ContractDocumentPreview
								pages={previewQuery.data?.pages}
								loading={previewQuery.isLoading || previewQuery.isFetching}
							/>
						</Box>
					</Box>
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
							disabled={busy}
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
							disabled={busy}
							onClick={() =>
								updateMutation.mutate({
									admin_edited_text: editedText,
									notes,
									send_to_partner: true,
								})
							}
						>
							Send to Partner
						</Button>
						<Button
							variant="outlined"
							color="warning"
							disabled={busy}
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
							disabled={busy}
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
					{actionError ? (
						<Alert severity="error" sx={{ mt: 2 }}>
							{actionError instanceof Error
								? actionError.message
								: "Action failed"}
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
					{finalPdfUrl ? (
						<Box sx={{ mt: 2 }}>
							<Typography variant="caption" color="text.secondary">
								Final PDF link:
							</Typography>
							<TextField
								value={finalPdfUrl}
								fullWidth
								size="small"
								InputProps={{ readOnly: true }}
							/>
						</Box>
					) : null}
				</Paper>

				{submission.status === "partner_signed" ? (
					<Paper sx={{ p: 3 }}>
						<Typography variant="subtitle1" gutterBottom>
							Board Signature
						</Typography>
						<Stack spacing={2}>
							<TextField
								label="Board signer name"
								value={boardSignerName}
								onChange={(event) => setBoardSignerName(event.target.value)}
								required
							/>
							<SignaturePad onChange={setBoardSignatureData} />
							<Button
								variant="contained"
								disabled={
									!boardSignatureData || !boardSignerName.trim() || busy
								}
								onClick={() =>
									boardSignMutation.mutate({
										signature_data: boardSignatureData ?? "",
										signer_name: boardSignerName.trim(),
									})
								}
							>
								Board Sign
							</Button>
						</Stack>
					</Paper>
				) : null}

				{submission.status === "board_signed" ? (
					<Paper sx={{ p: 3 }}>
						<Typography variant="subtitle1" gutterBottom>
							Final PDF
						</Typography>
						<Button
							variant="contained"
							disabled={busy}
							onClick={() => finalizeMutation.mutate()}
						>
							Generate Final PDF Link
						</Button>
					</Paper>
				) : null}
			</Stack>
		</ToolPageShell>
	);
}
