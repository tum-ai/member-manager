import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { PublicContractPageShell } from "./components/PublicContractPageShell";
import {
	PublicCommentForm,
	PublicContractCommentsSection,
	PublicSignatureForm,
	PublicSigningConfirmation,
} from "./components/PublicSigningSections";
import { StoredContractPdfSection } from "./components/StoredContractPdfSection";
import { useContractSignPage } from "./hooks/useContractSignPage";

export default function ContractSignPage(): JSX.Element {
	const signing = useContractSignPage();

	return (
		<PublicContractPageShell
			title="Sign contract"
			description="Review the document below, then add your signature to execute it."
		>
			{signing.loading ? (
				<div
					className="grid min-h-56 place-items-center"
					role="status"
					aria-label="Loading contract"
				>
					<Spinner />
				</div>
			) : signing.loadError ? (
				<Alert variant="destructive">
					<AlertDescription>{signing.loadError.message}</AlertDescription>
				</Alert>
			) : signing.submitted ? (
				<PublicSigningConfirmation>
					{signing.documentStatus
						? "Your signature was accepted. The signed document is being prepared."
						: "Thank you. The contract has been signed and a copy will be sent by email."}
				</PublicSigningConfirmation>
			) : signing.commentSubmitted ? (
				<PublicSigningConfirmation>
					Thank you. Your comments have been sent to TUM.ai.
				</PublicSigningConfirmation>
			) : signing.payload ? (
				<div className="flex flex-col gap-6">
					<StoredContractPdfSection
						pdfUrl={signing.pdfUrl}
						pdfLoading={signing.pdfLoading}
						pdfError={signing.pdfError}
						documentStatus={signing.documentStatus}
					/>
					<PublicContractCommentsSection comments={signing.payload.comments} />
					<PublicSignatureForm
						form={signing.signatureForm}
						title="Sign the contract"
						description="Enter your full name and draw or upload your signature. A signed copy will be emailed to you."
						submitLabel="Sign contract"
						submitting={signing.signing}
						error={signing.signError}
						onSignatureChange={signing.setSignatureData}
						onSubmit={signing.submitSignature}
					/>
					<PublicCommentForm
						form={signing.commentForm}
						submitting={signing.commenting}
						error={signing.commentError}
						onSubmit={signing.submitComment}
					/>
				</div>
			) : null}
		</PublicContractPageShell>
	);
}
