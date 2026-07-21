import type { PublicSignPayload } from "@member-manager/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import {
	fetchPublicSignPayload,
	postPublicComment,
	postPublicSignature,
} from "./contractApi";
import { SignaturePad } from "./SignaturePad";

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
		<div className="mx-auto w-full max-w-3xl px-4 py-12">
			<div className="mb-6">
				<p className="text-sm font-medium text-brand">TUM.ai</p>
				<h1 className="text-3xl font-bold tracking-tight">Sign contract</h1>
				<p className="mt-1 text-muted-foreground">
					Review the document below, then add your signature to execute it.
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
						Thank you - the contract has been signed. A copy will be sent by
						email.
					</AlertDescription>
				</Alert>
			) : commentSubmitted ? (
				<Alert>
					<AlertDescription>
						Thank you - your comments have been sent to TUM.ai.
					</AlertDescription>
				</Alert>
			) : payload ? (
				<div className="flex flex-col gap-6">
					<Card className="p-6">
						<ContractDocumentPreview pages={payload.pages} />
					</Card>
					{payload.comments.length > 0 ? (
						<Card className="p-6">
							<p className="mb-2 text-base font-medium">Comments</p>
							<div className="flex flex-col gap-4">
								{payload.comments.map((item, index) => (
									<div
										key={`${item.created_at}-${item.author_type}-${item.author_name ?? ""}-${item.comment}`}
									>
										{index > 0 ? <Separator className="mb-4" /> : null}
										<p className="text-xs text-muted-foreground">
											{item.author_type === "partner"
												? (item.author_name ?? "Partner")
												: (item.author_name ?? "TUM.ai")}{" "}
											- {new Date(item.created_at).toLocaleString()}
										</p>
										<p className="whitespace-pre-wrap">{item.comment}</p>
									</div>
								))}
							</div>
						</Card>
					) : null}
					<Card className="p-6">
						<p className="mb-1 text-base font-semibold">Sign the contract</p>
						<p className="mb-4 text-sm text-muted-foreground">
							Enter your full name and draw your signature to execute the
							contract. A signed copy will be emailed to you.
						</p>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="signer-name">Full name</Label>
								<Input
									id="signer-name"
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
					<Card className="p-6">
						<p className="mb-1 text-base font-semibold">
							Have questions before signing?
						</p>
						<p className="mb-4 text-sm text-muted-foreground">
							Send your questions or requested changes to TUM.ai instead of
							signing. We'll get back to you.
						</p>
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="sign-comment">Your message</Label>
								<Textarea
									id="sign-comment"
									value={comment}
									onChange={(event) => setComment(event.target.value)}
									rows={3}
								/>
							</div>
							<Button
								variant="outline"
								className="self-start"
								disabled={!comment.trim() || submitting}
								onClick={handleCommentSubmit}
							>
								Send message
							</Button>
						</div>
					</Card>
				</div>
			) : null}
		</div>
	);
}
