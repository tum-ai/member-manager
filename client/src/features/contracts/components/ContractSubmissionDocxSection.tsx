import {
	CONTRACT_DOCX_MIME_TYPE,
	MAX_CONTRACT_DOCX_BYTES,
} from "@member-manager/shared";
import { Download, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { StoredContractPdfSection } from "./StoredContractPdfSection";

export function ContractSubmissionDocxSection({
	detail,
}: {
	detail: ContractSubmissionDetailViewModel;
}): JSX.Element {
	const inputId = useId();
	const [fileError, setFileError] = useState<string | null>(null);

	function selectFile(file: File | undefined): void {
		if (!file) return;
		if (
			file.type !== CONTRACT_DOCX_MIME_TYPE &&
			!file.name.toLowerCase().endsWith(".docx")
		) {
			setFileError("Choose a DOCX file.");
			return;
		}
		if (file.size > MAX_CONTRACT_DOCX_BYTES) {
			setFileError("The DOCX file must be 10 MB or smaller.");
			return;
		}
		setFileError(null);
		detail.requestDocxUpload(file);
	}

	return (
		<div className="flex flex-col gap-6">
			<GlassCard className="p-5 sm:p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-lg font-semibold">Editable DOCX</h2>
							{detail.documentStatus ? (
								<Badge
									variant={
										detail.documentStatus === "ready"
											? "success"
											: detail.documentStatus === "failed"
												? "danger"
												: "accent"
									}
								>
									{detail.documentStatus === "processing"
										? "Converting"
										: detail.documentStatus}
								</Badge>
							) : null}
						</div>
						<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
							Download the filled DOCX, edit it in Word, then upload it here.
							The upload creates an immutable version and queues a new PDF.
						</p>
					</div>
					{detail.isContractsAdmin ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								disabled={detail.docxDownloading}
								onClick={detail.downloadDocx}
							>
								<Download className="size-4" />
								{detail.docxDownloading ? "Downloading…" : "Download DOCX"}
							</Button>
							<Button asChild disabled={detail.docxUploadPending}>
								<label htmlFor={inputId}>
									<Upload className="size-4" />
									{detail.docxUploadPending
										? "Uploading…"
										: "Upload edited DOCX"}
								</label>
							</Button>
							<input
								id={inputId}
								type="file"
								accept={`${CONTRACT_DOCX_MIME_TYPE},.docx`}
								className="sr-only"
								disabled={detail.docxUploadPending}
								onChange={(event) => {
									selectFile(event.target.files?.[0]);
									event.target.value = "";
								}}
							/>
						</div>
					) : null}
				</div>
				{fileError || detail.docxDownloadError ? (
					<p className="mt-4 text-sm text-destructive" role="alert">
						{fileError ?? detail.docxDownloadError}
					</p>
				) : null}
				{detail.docxUploadError ? (
					<Alert variant="destructive" className="mt-4">
						<AlertDescription>
							{detail.docxUploadError.message}
						</AlertDescription>
					</Alert>
				) : null}
				{detail.isContractsAdmin ? (
					<div className="mt-5 flex flex-col gap-1.5">
						<Label htmlFor="internal-notes">Internal notes</Label>
						<Textarea
							id="internal-notes"
							rows={2}
							value={detail.notes}
							onChange={(event) => detail.setNotes(event.target.value)}
						/>
					</div>
				) : null}
			</GlassCard>

			<StoredContractPdfSection
				pdfUrl={detail.storedPdfUrl}
				pdfLoading={detail.storedPdfLoading}
				pdfError={detail.storedPdfError}
				documentStatus={detail.documentStatus}
			/>
			<ConfirmDialog
				open={detail.pendingDocxFileName !== null}
				onOpenChange={(open) => {
					if (!open) detail.cancelDocxUpload();
				}}
				title="Upload edited DOCX?"
				description={`${detail.pendingDocxFileName ?? "This file"} creates a new immutable version, returns the contract to Legal review, and revokes current partner and board signing links.`}
				confirmLabel="Upload new version"
				onConfirm={detail.confirmDocxUpload}
			/>
		</div>
	);
}
