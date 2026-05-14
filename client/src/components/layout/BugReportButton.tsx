import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import {
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Stack,
	TextField,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { apiClient } from "../../lib/apiClient";

interface BugReportButtonProps {
	user: User | null;
}

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
	const [isSubmitting, setIsSubmitting] = useState(false);

	const trimmedMessage = message.trim();
	const canSubmit = trimmedMessage.length >= 5 && !isSubmitting;

	function resetForm(): void {
		setMessage("");
		setStepsToReproduce("");
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
				<DialogContent>
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
