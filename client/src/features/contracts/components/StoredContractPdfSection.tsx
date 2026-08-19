import { Download, ExternalLink, FileClock, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractDocumentPreview } from "@/features/contracts/ContractDocumentPreview";

export function StoredContractPdfSection({
	pdfUrl,
	pdfLoading,
	pdfError,
	documentStatus,
	legacyPages,
}: {
	pdfUrl: string | null;
	pdfLoading: boolean;
	pdfError: Error | null;
	documentStatus: string | null;
	legacyPages?: string[];
}): JSX.Element {
	if (pdfLoading) {
		return (
			<Card className="space-y-4 p-4 sm:p-6" aria-busy="true">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<FileClock className="size-4" />
					Loading the stored contract
				</div>
				<Skeleton className="h-[60vh] min-h-80 w-full rounded-lg" />
			</Card>
		);
	}

	if (pdfError) {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					The stored contract could not be loaded. {pdfError.message}
				</AlertDescription>
			</Alert>
		);
	}

	if (pdfUrl) {
		return (
			<Card className="overflow-hidden">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-brand/5 p-4 dark:bg-brand/10">
					<div>
						<p className="font-semibold">Contract PDF</p>
						<p className="text-sm text-muted-foreground">
							Review this stored document before signing.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" asChild>
							<a href={pdfUrl} target="_blank" rel="noreferrer">
								<ExternalLink className="size-4" />
								Open PDF
							</a>
						</Button>
						<Button variant="outline" size="sm" asChild>
							<a href={pdfUrl} download="contract.pdf">
								<Download className="size-4" />
								Download
							</a>
						</Button>
					</div>
				</div>
				<object
					data={pdfUrl}
					type="application/pdf"
					title="Contract PDF"
					className="h-[68vh] min-h-96 w-full bg-white"
				>
					<div className="grid min-h-96 place-items-center p-8 text-center">
						<div className="max-w-sm space-y-3">
							<FileText className="mx-auto size-10 text-brand" />
							<p>Your browser cannot display the PDF preview.</p>
							<Button asChild>
								<a href={pdfUrl} target="_blank" rel="noreferrer">
									Open contract PDF
								</a>
							</Button>
						</div>
					</div>
				</object>
			</Card>
		);
	}

	if (documentStatus === "queued" || documentStatus === "processing") {
		return (
			<Alert>
				<FileClock className="size-4" />
				<AlertDescription>
					The contract PDF is still being prepared. Refresh this page shortly.
				</AlertDescription>
			</Alert>
		);
	}

	if (documentStatus === "failed") {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					The contract PDF could not be prepared. Contact TUM.ai before signing.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Card className="p-2 sm:p-4">
			<ContractDocumentPreview pages={legacyPages} />
		</Card>
	);
}
