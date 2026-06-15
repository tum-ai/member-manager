import { MAX_CV_BYTES, MAX_CV_MB } from "@member-manager/shared";
import { CircleCheck, Download, FileText, Info, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useMemberCv } from "../../hooks/useMemberCv";
import { downloadPdfBlob } from "../../lib/pdfUtils";

const SOURCE_LABELS: Record<string, string> = {
	application: "From application",
	member_upload: "Uploaded by you",
	admin_upload: "Uploaded by admin",
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleDateString("en-GB", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

interface CvPanelProps {
	userId: string;
	id?: string;
	className?: string;
}

export default function CvPanel({ userId, id, className }: CvPanelProps) {
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDownloading, setIsDownloading] = useState(false);
	const {
		cv,
		isLoading,
		hasConsent,
		isConsentLoading,
		isConsentError,
		uploadCv,
		isUploading,
		fetchCvBlob,
	} = useMemberCv(userId);

	const handleSelectFile = () => fileInputRef.current?.click();

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		// Some browsers/OSes report an empty MIME type for local files, so fall
		// back to the .pdf extension. The server validates the PDF magic bytes.
		const looksLikePdf =
			file.type === "application/pdf" ||
			(file.type === "" && file.name.toLowerCase().endsWith(".pdf"));
		if (!looksLikePdf) {
			showToast("Please upload a PDF file.", "error");
			return;
		}
		if (file.size > MAX_CV_BYTES) {
			showToast(
				`CV is too large. The maximum size is ${MAX_CV_MB} MB.`,
				"error",
			);
			return;
		}

		try {
			await uploadCv(file);
			showToast(
				"Your new CV is now the current version. Future partner snapshots will use this version.",
				"success",
			);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to upload CV.",
				"error",
			);
		}
	};

	const handleDownload = async () => {
		if (!cv) return;
		setIsDownloading(true);
		try {
			const blob = await fetchCvBlob();
			downloadPdfBlob(blob, cv.original_filename);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to download CV.",
				"error",
			);
		} finally {
			setIsDownloading(false);
		}
	};

	return (
		<GlassCard variant="elevated" id={id} className={className}>
			<CardContent className="p-6">
				<div className="mb-1 flex items-center gap-2.5">
					<FileText className="size-5 text-brand" />
					<h2 className="text-base font-semibold">CV</h2>
				</div>
				<p className="mb-6 text-sm text-muted-foreground">
					PDF only, max {MAX_CV_MB} MB.
				</p>

				{isLoading ? (
					<div className="flex justify-center py-6">
						<Spinner className="size-6" />
					</div>
				) : cv ? (
					<div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-accent p-4">
						<FileText className="size-5 text-brand" />
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{cv.original_filename}</p>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<Badge variant="outline">
									{SOURCE_LABELS[cv.source] ?? cv.source}
								</Badge>
								<span className="text-xs text-muted-foreground">
									{formatBytes(cv.size_bytes)} · {formatDate(cv.uploaded_at)}
								</span>
							</div>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={handleDownload}
							disabled={isDownloading}
						>
							{isDownloading ? (
								<Spinner className="size-4" />
							) : (
								<Download className="size-4" />
							)}
							Download
						</Button>
					</div>
				) : (
					<p className="mb-4 text-sm text-muted-foreground">
						No CV on record yet. Upload one below.
					</p>
				)}

				<input
					ref={fileInputRef}
					type="file"
					accept="application/pdf"
					hidden
					onChange={handleFileChange}
				/>
				<Button onClick={handleSelectFile} disabled={isUploading}>
					{isUploading ? (
						<Spinner className="size-4" />
					) : (
						<Upload className="size-4" />
					)}
					{cv ? "Replace CV" : "Upload CV"}
				</Button>

				{!isConsentLoading && !isConsentError && (
					<div className="mt-6 flex items-start gap-2">
						{hasConsent ? (
							<CircleCheck className="mt-0.5 size-4 text-brand" />
						) : (
							<Info className="mt-0.5 size-4 text-muted-foreground" />
						)}
						<p className="text-sm text-muted-foreground">
							{hasConsent
								? "Your current CV may be shared with TUM.ai partners, based on your Data Privacy Notice consent."
								: "Your CV is not shared with TUM.ai partners. Partner sharing is governed by your Data Privacy Notice consent."}{" "}
							Manage this under the Data Privacy Notice in your agreements.
						</p>
					</div>
				)}
			</CardContent>
		</GlassCard>
	);
}
