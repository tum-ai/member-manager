import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Container,
	Divider,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ContractDocumentPreview from "./ContractDocumentPreview";
import SignaturePad from "./SignaturePad";
import {
	fetchPublicSignPayload,
	type PublicSignPayload,
	postPublicComment,
	postPublicSignature,
} from "./useContracts";

export default function ContractSignPage(): JSX.Element {
	const { token } = useParams<{ token: string }>();
	const [payload, setPayload] = useState<PublicSignPayload | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [signatureData, setSignatureData] = useState<string | null>(null);
	const [signerName, setSignerName] = useState("");
	const [comment, setComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [commentSubmitted, setCommentSubmitted] = useState(false);

	useEffect(() => {
		if (!token) return;
		setLoading(true);
		fetchPublicSignPayload(token)
			.then((data) => {
				setPayload(data);
				setLoadError(null);
			})
			.catch((error: Error) => setLoadError(error.message))
			.finally(() => setLoading(false));
	}, [token]);

	async function handleSubmit() {
		if (!token || !signatureData || !signerName.trim()) return;
		setSubmitting(true);
		setSubmitError(null);
		try {
			await postPublicSignature(token, {
				signature_data: signatureData,
				signer_name: signerName.trim(),
			});
			setSubmitted(true);
		} catch (error) {
			setSubmitError((error as Error).message);
		} finally {
			setSubmitting(false);
		}
	}

	async function handleCommentSubmit() {
		if (!token || !comment.trim()) return;
		setSubmitting(true);
		setSubmitError(null);
		try {
			await postPublicComment(token, { comment: comment.trim() });
			setCommentSubmitted(true);
		} catch (error) {
			setSubmitError((error as Error).message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Container maxWidth="md" sx={{ py: 6 }}>
			<Typography variant="h4" gutterBottom>
				Sign Contract
			</Typography>

			{loading ? (
				<CircularProgress />
			) : loadError ? (
				<Alert severity="error">{loadError}</Alert>
			) : submitted ? (
				<Alert severity="success">
					Thank you - the contract has been signed. A copy will be sent by
					email.
				</Alert>
			) : commentSubmitted ? (
				<Alert severity="success">
					Thank you - your comments have been sent to TUM.ai.
				</Alert>
			) : payload ? (
				<Stack spacing={3}>
					<Paper sx={{ p: 3 }}>
						<ContractDocumentPreview pages={payload.pages} />
					</Paper>
					{payload.comments.length > 0 ? (
						<Paper sx={{ p: 3 }}>
							<Typography variant="subtitle1" gutterBottom>
								Comments
							</Typography>
							<Stack spacing={2}>
								{payload.comments.map((item, index) => (
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
							</Stack>
						</Paper>
					) : null}
					<Paper sx={{ p: 3 }}>
						<Stack spacing={2}>
							<TextField
								label="Full Name"
								value={signerName}
								onChange={(event) => setSignerName(event.target.value)}
								required
							/>
							<Box>
								<Typography variant="subtitle2" gutterBottom>
									Signature
								</Typography>
								<SignaturePad onChange={setSignatureData} />
							</Box>
							{submitError ? (
								<Alert severity="error">{submitError}</Alert>
							) : null}
							<Button
								variant="contained"
								disabled={!signatureData || !signerName.trim() || submitting}
								onClick={handleSubmit}
							>
								Sign
							</Button>
						</Stack>
					</Paper>
					<Paper sx={{ p: 3 }}>
						<Stack spacing={2}>
							<TextField
								label="Comments instead of signature"
								value={comment}
								onChange={(event) => setComment(event.target.value)}
								multiline
								minRows={3}
								fullWidth
							/>
							<Button
								variant="outlined"
								disabled={!comment.trim() || submitting}
								onClick={handleCommentSubmit}
							>
								Send Comments
							</Button>
						</Stack>
					</Paper>
				</Stack>
			) : null}
		</Container>
	);
}
