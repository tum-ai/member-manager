import {
	CONTRACT_DOCX_MIME_TYPE,
	type ContractArtifactStatus,
	MAX_CONTRACT_DOCX_BYTES,
} from "@member-manager/shared";
import {
	CheckCircle2,
	Clock3,
	Eye,
	FileText,
	RefreshCw,
	RotateCcw,
	Upload,
	XCircle,
} from "lucide-react";
import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Progress } from "@/components/ui/progress";
import type { ContractTemplateEditorViewModel } from "@/features/contracts/contractTemplatesPageTypes";

const STATUS_DETAILS: Record<
	ContractArtifactStatus,
	{ label: string; variant: BadgeVariant; icon: typeof Clock3 }
> = {
	queued: { label: "Queued", variant: "neutral", icon: Clock3 },
	processing: { label: "Converting", variant: "accent", icon: RefreshCw },
	ready: { label: "Ready", variant: "success", icon: CheckCircle2 },
	failed: { label: "Failed", variant: "danger", icon: XCircle },
};

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validationIssueLabel(issue: unknown, index: number): string {
	if (issue && typeof issue === "object") {
		const record = issue as Record<string, unknown>;
		const severity =
			typeof record.severity === "string" ? `${record.severity}: ` : "";
		if (typeof record.message === "string")
			return `${severity}${record.message}`;
		if (typeof record.code === "string") return `${severity}${record.code}`;
	}
	return `Validation issue ${index + 1}`;
}

export function ContractTemplateDocumentsPanel({
	model,
}: {
	model: ContractTemplateEditorViewModel;
}): JSX.Element {
	const uploadId = useId();
	const [fileError, setFileError] = useState<string | null>(null);
	const activeDocument = model.documents.find(
		(document) => document.id === model.activeDocumentId,
	);

	function selectFile(file: File | undefined): void {
		if (!file) return;
		const validType =
			file.type === CONTRACT_DOCX_MIME_TYPE ||
			file.name.toLowerCase().endsWith(".docx");
		if (!validType) {
			setFileError("Choose a DOCX file.");
			return;
		}
		if (file.size > MAX_CONTRACT_DOCX_BYTES) {
			setFileError("The DOCX file must be 10 MB or smaller.");
			return;
		}
		setFileError(null);
		model.uploadDocument(file);
	}

	return (
		<GlassCard className="p-5 sm:p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">DOCX document versions</h2>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Upload the legal source document. The first successful conversion
						activates automatically. Activate a ready version to replace or roll
						back the current version.
					</p>
				</div>
				<Button asChild disabled={model.uploadPending}>
					<label htmlFor={uploadId}>
						<Upload className="size-4" />
						{model.uploadPending ? "Uploading…" : "Upload DOCX"}
					</label>
				</Button>
				<input
					id={uploadId}
					type="file"
					accept={`${CONTRACT_DOCX_MIME_TYPE},.docx`}
					className="sr-only"
					disabled={model.uploadPending}
					onChange={(event) => {
						selectFile(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
			</div>

			{model.uploadPending ? (
				<div className="mt-4" aria-live="polite">
					<Progress value={35} aria-label="Uploading DOCX" />
					<p className="mt-2 text-sm text-muted-foreground">
						Uploading and queueing conversion…
					</p>
				</div>
			) : null}
			{fileError ? (
				<p className="mt-4 text-sm text-destructive" role="alert">
					{fileError}
				</p>
			) : null}
			{model.uploadError ? (
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>{model.uploadError.message}</AlertDescription>
				</Alert>
			) : null}

			{model.documents.length === 0 ? (
				<div className="mt-6 rounded-lg bg-muted/50 p-6 text-center dark:bg-brand/5">
					<FileText className="mx-auto size-8 text-brand" />
					<p className="mt-2 font-medium">No DOCX version uploaded</p>
					<p className="mt-1 text-sm text-muted-foreground">
						This template continues to use the legacy text renderer.
					</p>
				</div>
			) : (
				<ol className="mt-6 space-y-3" aria-label="DOCX document versions">
					{model.documents.map((document) => {
						const status = STATUS_DETAILS[document.status];
						const StatusIcon = status.icon;
						const isActive = document.id === model.activeDocumentId;
						return (
							<li
								key={document.id}
								className="rounded-lg bg-muted/40 p-4 dark:bg-brand/5"
							>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="truncate font-medium">
												Version {document.version}: {document.original_filename}
											</p>
											<Badge variant={status.variant}>
												<StatusIcon
													className={
														document.status === "processing"
															? "animate-spin"
															: undefined
													}
												/>
												{status.label}
											</Badge>
											{isActive ? <Badge variant="brand">Active</Badge> : null}
										</div>
										<p className="mt-1 text-xs text-muted-foreground">
											{formatBytes(document.source_size_bytes)} · Uploaded{" "}
											{new Date(document.created_at).toLocaleString()} · SHA{" "}
											{document.source_sha256.slice(0, 10)}
										</p>
										{document.error_message ? (
											<p className="mt-2 text-sm text-destructive" role="alert">
												{document.error_message}
											</p>
										) : null}
										{document.validation_issues.length > 0 ? (
											<div className="mt-3 rounded-md bg-background/70 p-3">
												<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
													Validation results
												</p>
												<ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
													{document.validation_issues.map((issue, index) => {
														const label = validationIssueLabel(issue, index);
														return (
															<li key={`${document.id}-${label}`}>{label}</li>
														);
													})}
												</ul>
											</div>
										) : document.status === "ready" ? (
											<p className="mt-2 text-sm text-muted-foreground">
												Validation passed with no reported issues.
											</p>
										) : null}
									</div>
									<div className="flex shrink-0 flex-wrap gap-2">
										{document.status === "ready" ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => model.previewDocument(document.id)}
											>
												<Eye className="size-4" />
												Preview
											</Button>
										) : null}
										{document.status === "failed" ? (
											<Button
												variant="outline"
												size="sm"
												disabled={model.retryingDocumentId === document.id}
												onClick={() => model.retryDocument(document.id)}
											>
												<RefreshCw className="size-4" />
												Retry
											</Button>
										) : null}
										{document.status === "ready" && !isActive ? (
											<Button
												variant="outline"
												size="sm"
												disabled={model.activatingDocumentId === document.id}
												onClick={() => model.activateDocument(document.id)}
											>
												<RotateCcw className="size-4" />
												{activeDocument &&
												document.version < activeDocument.version
													? "Roll back"
													: "Activate"}
											</Button>
										) : null}
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			)}

			{model.retryError || model.activateError ? (
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>
						{model.retryError?.message ?? model.activateError?.message}
					</AlertDescription>
				</Alert>
			) : null}
		</GlassCard>
	);
}
