import type { PublicBoardSignPayload } from "@member-manager/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import {
	fetchPublicBoardSignPayload,
	postPublicBoardSignature,
} from "./contractApi";
import { SignaturePad } from "./SignaturePad";

export default function ContractBoardSignPage(): JSX.Element {
	const { token } = useParams<{ token: string }>();
	const [payload, setPayload] = useState<PublicBoardSignPayload | null>(null);
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
		fetchPublicBoardSignPayload(token)
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
			await postPublicBoardSignature(token, {
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
		<div className="mx-auto w-full max-w-3xl px-4 py-12">
			<div className="mb-6">
				<p className="text-sm font-medium text-brand">TUM.ai</p>
				<h1 className="text-3xl font-bold tracking-tight">Board signature</h1>
				<p className="mt-1 text-muted-foreground">
					Review the document below and add the board signature to execute it.
				</p>
			</div>

			{loading ? (
				<Spinner />
			) : loadError ? (
				<Alert variant="destructive">
					<AlertDescription>{loadError}</AlertDescription>
				</Alert>
			) : submitted ? (
				<Alert>
					<AlertDescription>
						Thank you - the board signature has been recorded.
					</AlertDescription>
				</Alert>
			) : payload ? (
				<div className="flex flex-col gap-6">
					<Card className="p-6">
						<ContractDocumentPreview pages={payload.pages} />
					</Card>
					{payload.partner_signature_data ? (
						<Card className="p-6">
							<p className="mb-2 text-base font-medium">Partner signature</p>
							<div className="text-sm">
								<span className="text-muted-foreground">Signed by </span>
								<span className="font-medium">
									{payload.partner_signer_name || "Partner"}
								</span>
								{payload.partner_signed_at ? (
									<span className="text-muted-foreground">
										{" "}
										on {new Date(payload.partner_signed_at).toLocaleString()}
									</span>
								) : null}
							</div>
							<img
								src={payload.partner_signature_data}
								alt={`Signature of ${payload.partner_signer_name || "the partner"}`}
								className="mt-2 max-h-32 w-auto rounded-md border bg-white p-2"
							/>
						</Card>
					) : null}
					<Card className="p-6">
						<p className="mb-1 text-base font-semibold">Sign as the board</p>
						<p className="mb-4 text-sm text-muted-foreground">
							Enter the board signer's full name and draw the signature to
							execute the contract.
						</p>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="board-signer-name">Full name</Label>
								<Input
									id="board-signer-name"
									value={signerName}
									onChange={(event) => setSignerName(event.target.value)}
									required
								/>
							</div>
							<div>
								<p className="mb-2 text-sm font-medium">Signature</p>
								<SignaturePad onChange={setSignatureData} />
							</div>
							{submitError ? (
								<Alert variant="destructive">
									<AlertDescription>{submitError}</AlertDescription>
								</Alert>
							) : null}
							<Button
								className="self-start"
								disabled={!signatureData || !signerName.trim() || submitting}
								onClick={handleSubmit}
							>
								Sign
							</Button>
						</div>
					</Card>
				</div>
			) : null}
		</div>
	);
}
