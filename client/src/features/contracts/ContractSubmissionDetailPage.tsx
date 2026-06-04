import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Divider,
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
	useContractSubmissionComments,
	useContractSubmissionPreview,
	useCreateContractSubmissionComment,
	useFinalizeContractSubmission,
	useUpdateContractSubmission,
} from "./useContracts";

export default function ContractSubmissionDetailPage(): JSX.Element {
	const { id } = useParams<{ id: string }>();
	const submissionQuery = useContractSubmission(id);
	const updateMutation = useUpdateContractSubmission(id ?? "");
	const boardSignMutation = useBoardSignContractSubmission(id ?? "");
	const finalizeMutation = useFinalizeContractSubmission(id ?? "");
	const commentsQuery = useContractSubmissionComments(id);
	const createCommentMutation = useCreateContractSubmissionComment(id ?? "");

	const [editedText, setEditedText] = useState("");
	const [notes, setNotes] = useState("");
	const [internalComment, setInternalComment] = useState("");
	const [boardSignatureData, setBoardSignatureData] = useState<string | null>(
		null,
	);
	const [boardSignerName, setBoardSignerName] = useState("");
	const [partnerEmailSubject, setPartnerEmailSubject] = useState("");
	const [partnerEmailMessage, setPartnerEmailMessage] = useState("");
	const previewQuery = useContractSubmissionPreview(id, editedText);

	useEffect(() => {
		const data = submissionQuery.data;
		if (data) {
			setEditedText(
				data.admin_edited_text ?? data.generated_contract_text ?? "",
			);
			setNotes(data.notes ?? "");
			const partnerCompany =
				typeof data.form_data.partner_company_name === "string"
					? data.form_data.partner_company_name
					: "your team";
			setPartnerEmailSubject(`TUM.ai contract for ${partnerCompany}`);
			setPartnerEmailMessage(
				"Please review and sign the contract using the secure link below.",
			);
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
		finalizeMutation.isPending ||
		createCommentMutation.isPending;
	const actionError =
		updateMutation.error ??
		boardSignMutation.error ??
		finalizeMutation.error ??
		createCommentMutation.error;
	const comments = commentsQuery.data ?? [];
	const hasLegacyComment = submission.partner_comment && comments.length === 0;

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
							variant="contained"
							disabled={busy}
							onClick={() =>
								updateMutation.mutate({
									admin_edited_text: editedText,
									notes,
									send_partner_email: true,
									partner_email_subject: partnerEmailSubject,
									partner_email_message: partnerEmailMessage,
								})
							}
						>
							Send Email to Partner
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
					<Stack spacing={2} sx={{ mt: 2 }}>
						<TextField
							label="Partner email subject"
							value={partnerEmailSubject}
							onChange={(event) => setPartnerEmailSubject(event.target.value)}
							fullWidth
							size="small"
						/>
						<TextField
							label="Partner email message"
							value={partnerEmailMessage}
							onChange={(event) => setPartnerEmailMessage(event.target.value)}
							fullWidth
							multiline
							minRows={2}
						/>
					</Stack>
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
					{submission.partner_email_sent_at ? (
						<Alert severity="success" sx={{ mt: 2 }}>
							Email sent to {submission.partner_email_recipient} at{" "}
							{new Date(submission.partner_email_sent_at).toLocaleString()}
						</Alert>
					) : null}
					{submission.partner_email_error ? (
						<Alert severity="warning" sx={{ mt: 2 }}>
							Last email error: {submission.partner_email_error}
						</Alert>
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

				<Paper sx={{ p: 3 }}>
					<Typography variant="subtitle1" gutterBottom>
						Comment History
					</Typography>
					{commentsQuery.isLoading ? (
						<CircularProgress size={20} />
					) : commentsQuery.error ? (
						<Alert severity="error">
							{(commentsQuery.error as Error).message}
						</Alert>
					) : comments.length > 0 || hasLegacyComment ? (
						<Stack spacing={2}>
							{comments.map((item, index) => (
								<Box key={item.id}>
									{index > 0 ? <Divider sx={{ mb: 2 }} /> : null}
									<Typography variant="caption" color="text.secondary">
										{item.author_type === "partner"
											? (item.author_name ?? "Partner")
											: (item.author_name ?? "TUM.ai")}{" "}
										- {new Date(item.created_at).toLocaleString()}
									</Typography>
									<Typography sx={{ whiteSpace: "pre-wrap" }}>
										{item.comment}
									</Typography>
								</Box>
							))}
							{hasLegacyComment ? (
								<Box>
									<Typography variant="caption" color="text.secondary">
										Partner
									</Typography>
									<Typography sx={{ whiteSpace: "pre-wrap" }}>
										{submission.partner_comment}
									</Typography>
								</Box>
							) : null}
						</Stack>
					) : (
						<Typography color="text.secondary">
							No partner comments yet.
						</Typography>
					)}
					<Stack spacing={2} sx={{ mt: 2 }}>
						<TextField
							label="Internal reply"
							value={internalComment}
							onChange={(event) => setInternalComment(event.target.value)}
							multiline
							minRows={3}
							fullWidth
						/>
						<Box>
							<Button
								variant="outlined"
								disabled={!internalComment.trim() || busy}
								onClick={() =>
									createCommentMutation.mutate(
										{ comment: internalComment.trim() },
										{ onSuccess: () => setInternalComment("") },
									)
								}
							>
								Add Internal Reply
							</Button>
						</Box>
					</Stack>
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
