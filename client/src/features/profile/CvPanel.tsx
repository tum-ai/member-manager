import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	FormControlLabel,
	Switch,
	Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { useMemberCv } from "../../hooks/useMemberCv";
import { downloadPdfBlob } from "../../lib/pdfUtils";

const MAX_CV_BYTES = 5 * 1024 * 1024;

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
}

export default function CvPanel({ userId }: CvPanelProps) {
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDownloading, setIsDownloading] = useState(false);
	const {
		cv,
		isLoading,
		consentAt,
		isConsentLoading,
		uploadCv,
		isUploading,
		setConsent,
		isSavingConsent,
		fetchCvBlob,
	} = useMemberCv(userId);

	const handleSelectFile = () => fileInputRef.current?.click();

	const handleFileChange = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;

		if (file.type !== "application/pdf") {
			showToast("Please upload a PDF file.", "error");
			return;
		}
		if (file.size > MAX_CV_BYTES) {
			showToast("CV is too large. The maximum size is 5 MB.", "error");
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

	const handleConsentToggle = async (
		_event: React.ChangeEvent<HTMLInputElement>,
		checked: boolean,
	) => {
		try {
			await setConsent(checked);
			showToast(
				checked
					? "You consented to sharing your CV with TUM.ai partners."
					: "You withdrew consent. Your CV will not be included in future partner snapshots.",
				"success",
			);
		} catch (error) {
			showToast(
				error instanceof Error ? error.message : "Failed to update consent.",
				"error",
			);
		}
	};

	return (
		<GlassCard variant="elevated" sx={{ mt: 3 }}>
			<CardContent sx={{ p: 3 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
					<DescriptionOutlinedIcon sx={{ color: "primary.main" }} />
					<Typography variant="h6" sx={{ fontWeight: 500 }}>
						CV
					</Typography>
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
					PDF only, max 5 MB.
				</Typography>

				{isLoading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
						<CircularProgress size={24} />
					</Box>
				) : cv ? (
					<Box
						sx={{
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: 2,
							p: 2,
							borderRadius: 3,
							bgcolor: "action.hover",
							mb: 2,
						}}
					>
						<DescriptionOutlinedIcon sx={{ color: "primary.main" }} />
						<Box sx={{ minWidth: 0, flex: 1 }}>
							<Typography variant="body1" sx={{ fontWeight: 500 }} noWrap>
								{cv.original_filename}
							</Typography>
							<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
								<Chip size="small" label={`Version ${cv.version}`} />
								<Chip
									size="small"
									variant="outlined"
									label={SOURCE_LABELS[cv.source] ?? cv.source}
								/>
								<Typography variant="caption" color="text.secondary">
									{formatBytes(cv.size_bytes)} · {formatDate(cv.uploaded_at)}
								</Typography>
							</Box>
						</Box>
						<Button
							variant="outlined"
							size="small"
							startIcon={
								isDownloading ? (
									<CircularProgress size={16} />
								) : (
									<DownloadIcon />
								)
							}
							onClick={handleDownload}
							disabled={isDownloading}
						>
							Download
						</Button>
					</Box>
				) : (
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						No CV on record yet. Upload one below.
					</Typography>
				)}

				<input
					ref={fileInputRef}
					type="file"
					accept="application/pdf"
					hidden
					onChange={handleFileChange}
				/>
				<Button
					variant="contained"
					startIcon={
						isUploading ? <CircularProgress size={16} /> : <UploadFileIcon />
					}
					onClick={handleSelectFile}
					disabled={isUploading}
				>
					{cv ? "Replace CV" : "Upload CV"}
				</Button>

				<Box sx={{ mt: 3 }}>
					<FormControlLabel
						control={
							<Switch
								checked={consentAt !== null}
								onChange={handleConsentToggle}
								disabled={isConsentLoading || isSavingConsent}
							/>
						}
						label={
							<Typography variant="body2">
								Allow my current CV to be shared with TUM.ai partners
							</Typography>
						}
					/>
					{consentAt && (
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ display: "block", ml: 6 }}
						>
							Consented on {formatDate(consentAt)}. Only your current CV is
							shared; new uploads replace it in future snapshots.
						</Typography>
					)}
				</Box>
			</CardContent>
		</GlassCard>
	);
}
