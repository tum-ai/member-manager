import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import {
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	IconButton,
	Stack,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import { type ClipboardEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { apiClient } from "../../lib/apiClient";

interface BugReportButtonProps {
	user: User | null;
}

// Mirrors the server-side limits in server/src/lib/bugReportImages.ts.
const MAX_IMAGE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
];

function getPageUrl(): string {
	if (typeof window === "undefined") {
		return "";
	}

	return window.location.href;
}

function getUserAgent(): string {
	if (typeof window === "undefined") {
		return "";
	}

	return window.navigator.userAgent;
}

export default function BugReportButton({
	user,
}: BugReportButtonProps): JSX.Element {
	const theme = useTheme();
	const location = useLocation();
	const { showToast } = useToast();
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState("");
	const [stepsToReproduce, setStepsToReproduce] = useState("");
	const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const trimmedMessage = message.trim();
	const canSubmit = trimmedMessage.length >= 5 && !isSubmitting;

	function resetForm(): void {
		setMessage("");
		setStepsToReproduce("");
		setImageDataUrl(null);
	}

	// Let users paste a screenshot straight into the dialog. We grab the first
	// image off the clipboard, validate it, and keep it as a data URL for both
	// the preview and the submit payload.
	function handlePaste(event: ClipboardEvent<HTMLDivElement>): void {
		if (isSubmitting) {
			return;
		}
		const imageItem = Array.from(event.clipboardData?.items ?? []).find(
			(item) => item.kind === "file" && item.type.startsWith("image/"),
		);
		if (!imageItem) {
			return;
		}
		event.preventDefault();
		const file = imageItem.getAsFile();
		if (!file) {
			return;
		}
		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			showToast(
				"Only PNG, JPEG, GIF, or WebP images can be attached.",
				"error",
			);
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			showToast(`Image is too large (max ${MAX_IMAGE_MB} MB).`, "error");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setImageDataUrl(typeof reader.result === "string" ? reader.result : null);
		};
		reader.onerror = () => {
			showToast("Could not read the pasted image.", "error");
		};
		reader.readAsDataURL(file);
	}

	function handleClose(): void {
		if (isSubmitting) {
			return;
		}
		setIsOpen(false);
	}

	async function handleSubmit(): Promise<void> {
		if (!canSubmit) {
			return;
		}

		setIsSubmitting(true);
		try {
			await apiClient("/api/bug-reports", {
				method: "POST",
				body: JSON.stringify({
					message: trimmedMessage,
					stepsToReproduce: stepsToReproduce.trim() || undefined,
					pageUrl: getPageUrl(),
					path: `${location.pathname}${location.search}${location.hash}`,
					userAgent: getUserAgent(),
					image: imageDataUrl
						? { dataBase64: imageDataUrl.split(",")[1] ?? "" }
						: undefined,
				}),
			});
			showToast("Bug report sent. Thanks for flagging it.", "success");
			setIsOpen(false);
			resetForm();
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Could not submit bug report right now.",
				"error",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Box sx={{ display: "flex", justifyContent: "center" }}>
			<Button
				type="button"
				size="small"
				startIcon={<BugReportOutlinedIcon fontSize="small" />}
				onClick={() => setIsOpen(true)}
				aria-label="Report a bug"
				sx={{
					color: theme.palette.text.secondary,
					opacity: 0.42,
					px: 1.25,
					py: 0.5,
					minWidth: 0,
					fontSize: "0.78rem",
					borderRadius: 999,
					backgroundColor: "transparent",
					"&:hover": {
						opacity: 1,
						color: theme.palette.primary.main,
						backgroundColor: alpha(theme.palette.primary.main, 0.08),
					},
					"&:focus-visible": {
						opacity: 1,
						outline: `2px solid ${alpha(theme.palette.primary.main, 0.6)}`,
						outlineOffset: 2,
					},
				}}
			>
				Report a bug
			</Button>

			<Dialog
				open={isOpen}
				onClose={handleClose}
				fullWidth
				maxWidth="sm"
				PaperProps={{
					sx: {
						borderRadius: 4,
						backgroundColor:
							theme.palette.mode === "light"
								? alpha(theme.palette.background.paper, 0.98)
								: alpha(theme.palette.background.paper, 0.96),
						backdropFilter: "blur(20px)",
					},
				}}
			>
				<DialogTitle>Report a bug</DialogTitle>
				<DialogContent onPaste={handlePaste}>
					<Stack spacing={2.5} sx={{ pt: 0.5 }}>
						<DialogContentText>
							Send a short note to the Member Manager team. We’ll include your
							current page and account so we can reproduce it faster.
						</DialogContentText>
						<TextField
							label="What went wrong?"
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							multiline
							minRows={4}
							required
							inputProps={{ maxLength: 2000 }}
							helperText={`${trimmedMessage.length}/2000 · minimum 5 characters`}
							autoFocus
						/>
						<TextField
							label="Steps to reproduce (optional)"
							value={stepsToReproduce}
							onChange={(event) => setStepsToReproduce(event.target.value)}
							multiline
							minRows={3}
							inputProps={{ maxLength: 2000 }}
							helperText={
								user?.email
									? `Submitting as ${user.email}`
									: "Submitting securely"
							}
						/>
						{imageDataUrl ? (
							<Box
								sx={{
									position: "relative",
									alignSelf: "flex-start",
									maxWidth: "100%",
									borderRadius: 2,
									overflow: "hidden",
									border: `1px solid ${theme.palette.divider}`,
								}}
							>
								<Box
									component="img"
									src={imageDataUrl}
									alt="Attached screenshot"
									sx={{ display: "block", maxWidth: "100%", maxHeight: 220 }}
								/>
								<IconButton
									size="small"
									onClick={() => setImageDataUrl(null)}
									disabled={isSubmitting}
									aria-label="Remove attached image"
									sx={{
										position: "absolute",
										top: 6,
										right: 6,
										backgroundColor: alpha("#000000", 0.55),
										color: "#FFFFFF",
										"&:hover": { backgroundColor: alpha("#000000", 0.72) },
									}}
								>
									<CloseIcon fontSize="small" />
								</IconButton>
							</Box>
						) : (
							<Stack
								direction="row"
								spacing={0.75}
								alignItems="center"
								sx={{ color: "text.secondary" }}
							>
								<ImageOutlinedIcon fontSize="small" />
								<Typography variant="caption">
									Tip: paste a screenshot (Ctrl/Cmd+V) to attach it.
								</Typography>
							</Stack>
						)}
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, pb: 3 }}>
					<Button onClick={handleClose} disabled={isSubmitting} color="inherit">
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!canSubmit}
						variant="contained"
						startIcon={
							isSubmitting ? (
								<CircularProgress size={16} color="inherit" />
							) : null
						}
					>
						{isSubmitting ? "Sending" : "Send report"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
