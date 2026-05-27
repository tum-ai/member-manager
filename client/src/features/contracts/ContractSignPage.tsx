import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Container,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SignaturePad from "./SignaturePad";
import {
	fetchPublicSignPayload,
	type PublicSignPayload,
	postPublicSignature,
} from "./useContracts";

export default function ContractSignPage(): JSX.Element {
	const { token } = useParams<{ token: string }>();
	const [payload, setPayload] = useState<PublicSignPayload | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [signatureData, setSignatureData] = useState<string | null>(null);
	const [signerName, setSignerName] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

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

	return (
		<Container maxWidth="md" sx={{ py: 6 }}>
			<Typography variant="h4" gutterBottom>
				Vertrag unterzeichnen
			</Typography>

			{loading ? (
				<CircularProgress />
			) : loadError ? (
				<Alert severity="error">{loadError}</Alert>
			) : submitted ? (
				<Alert severity="success">
					Vielen Dank — der Vertrag wurde unterzeichnet. Eine Kopie wird per
					E-Mail versendet.
				</Alert>
			) : payload ? (
				<Stack spacing={3}>
					<Paper sx={{ p: 3, maxHeight: 400, overflow: "auto" }}>
						<Typography
							sx={{
								whiteSpace: "pre-wrap",
								fontFamily: "monospace",
								fontSize: 13,
							}}
						>
							{payload.contract_text}
						</Typography>
					</Paper>
					<Paper sx={{ p: 3 }}>
						<Stack spacing={2}>
							<TextField
								label="Vollständiger Name"
								value={signerName}
								onChange={(event) => setSignerName(event.target.value)}
								required
							/>
							<Box>
								<Typography variant="subtitle2" gutterBottom>
									Unterschrift
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
								Unterzeichnen
							</Button>
						</Stack>
					</Paper>
				</Stack>
			) : null}
		</Container>
	);
}
