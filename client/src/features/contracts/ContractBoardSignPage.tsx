import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { PublicContractPageShell } from "./components/PublicContractPageShell";
import {
	PartnerSignatureSummary,
	PublicSignatureForm,
	PublicSigningConfirmation,
} from "./components/PublicSigningSections";
import { StoredContractPdfSection } from "./components/StoredContractPdfSection";
import { useContractBoardSignPage } from "./hooks/useContractBoardSignPage";

export default function ContractBoardSignPage(): JSX.Element {
	const signing = useContractBoardSignPage();

	return (
		<PublicContractPageShell
			title="Board signature"
			description="Review the partner signed document and add the board signature to execute it."
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
						? "The board signature was accepted. The signed document is being prepared."
						: "Thank you. The board signature has been recorded."}
				</PublicSigningConfirmation>
			) : signing.payload ? (
				<div className="flex flex-col gap-6">
					<StoredContractPdfSection
						pdfUrl={signing.pdfUrl}
						pdfLoading={signing.pdfLoading}
						pdfError={signing.pdfError}
						documentStatus={signing.documentStatus}
						legacyPages={signing.payload.pages}
					/>
					{signing.payload.partner_signature_data ? (
						<PartnerSignatureSummary
							signerName={signing.payload.partner_signer_name}
							signedAt={signing.payload.partner_signed_at}
							signatureData={signing.payload.partner_signature_data}
						/>
					) : null}
					<PublicSignatureForm
						form={signing.signatureForm}
						title="Sign as the board"
						description="Enter the board signer’s full name and draw or upload the signature."
						submitLabel="Add board signature"
						submitting={signing.signing}
						error={signing.signError}
						onSignatureChange={signing.setSignatureData}
						onSubmit={signing.submitSignature}
					/>
				</div>
			) : null}
		</PublicContractPageShell>
	);
}
