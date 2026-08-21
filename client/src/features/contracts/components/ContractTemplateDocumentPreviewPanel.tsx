import { Download, ExternalLink, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContractTemplateEditorViewModel } from "@/features/contracts/contractTemplatesPageTypes";

export function ContractTemplateDocumentPreviewPanel({
	model,
}: {
	model: ContractTemplateEditorViewModel;
}): JSX.Element | null {
	if (!model.previewDocumentId) return null;
	const document = model.documents.find(
		(item) => item.id === model.previewDocumentId,
	);
	const waiting =
		document?.status === "queued" || document?.status === "processing";
	const documentError =
		document?.status === "failed"
			? (document.error_message ?? "The stored PDF could not be prepared.")
			: null;

	return (
		<GlassCard className="overflow-hidden">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-brand/5 p-4 dark:bg-brand/10">
				<div>
					<h2 className="font-semibold">Stored PDF preview</h2>
					<p className="text-sm text-muted-foreground">
						{document?.original_filename ?? "Converted DOCX"}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{model.previewPdfUrl ? (
						<>
							<Button variant="outline" size="sm" asChild>
								<a href={model.previewPdfUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="size-4" />
									Open
								</a>
							</Button>
							<Button variant="outline" size="sm" asChild>
								<a href={model.previewPdfUrl} download="contract-template.pdf">
									<Download className="size-4" />
									Download
								</a>
							</Button>
						</>
					) : null}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Close PDF preview"
						onClick={() => model.previewDocument(null)}
					>
						<X className="size-4" />
					</Button>
				</div>
			</div>
			{waiting ? (
				<div
					className="grid min-h-64 place-items-center p-8 text-center"
					aria-live="polite"
				>
					<div>
						<p className="font-medium">Preparing the stored PDF</p>
						<p className="mt-1 text-sm text-muted-foreground">
							The preview will load automatically when conversion finishes.
						</p>
					</div>
				</div>
			) : model.previewLoading ? (
				<div className="p-4" aria-busy="true">
					<Skeleton className="h-[65vh] min-h-96 w-full" />
				</div>
			) : documentError ? (
				<Alert variant="destructive" className="m-4">
					<AlertDescription>{documentError}</AlertDescription>
				</Alert>
			) : model.previewError ? (
				<Alert variant="destructive" className="m-4">
					<AlertDescription>{model.previewError.message}</AlertDescription>
				</Alert>
			) : model.previewPdfUrl ? (
				<object
					data={model.previewPdfUrl}
					type="application/pdf"
					title="Stored contract template PDF"
					className="h-[70vh] min-h-96 w-full bg-white"
				>
					<p className="p-6 text-center">
						Your browser cannot display this PDF. Use Open or Download above.
					</p>
				</object>
			) : null}
		</GlassCard>
	);
}
