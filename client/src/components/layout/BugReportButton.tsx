import type { User } from "@supabase/supabase-js";
import { Bug, ImageIcon, Loader2, X } from "lucide-react";
import { type ClipboardEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/contexts/ToastContext";
import { apiClient } from "@/lib/apiClient";

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

export function BugReportButton({ user }: BugReportButtonProps): JSX.Element {
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

	function handleOpenChange(open: boolean): void {
		if (!open && isSubmitting) {
			return;
		}
		setIsOpen(open);
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
		<div className="flex justify-center">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => setIsOpen(true)}
				aria-label="Report a bug"
				className="text-xs text-muted-foreground opacity-60 hover:opacity-100"
			>
				<Bug className="size-4" />
				Report a bug
			</Button>

			<Dialog open={isOpen} onOpenChange={handleOpenChange}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Report a bug</DialogTitle>
						<DialogDescription>
							Send a short note to the Member Manager team. We’ll include your
							current page and account so we can reproduce it faster.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-5" onPaste={handlePaste}>
						<div className="grid gap-2">
							<Label htmlFor="bug-message">What went wrong?</Label>
							<Textarea
								id="bug-message"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								rows={4}
								required
								maxLength={2000}
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								{trimmedMessage.length}/2000 · minimum 5 characters
							</p>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="bug-steps">Steps to reproduce (optional)</Label>
							<Textarea
								id="bug-steps"
								value={stepsToReproduce}
								onChange={(event) => setStepsToReproduce(event.target.value)}
								rows={3}
								maxLength={2000}
							/>
							<p className="text-xs text-muted-foreground">
								{user?.email
									? `Submitting as ${user.email}`
									: "Submitting securely"}
							</p>
						</div>

						{imageDataUrl ? (
							<div className="relative max-w-full self-start overflow-hidden rounded-lg border">
								<img
									src={imageDataUrl}
									alt="Attached screenshot"
									className="block max-h-56 max-w-full"
								/>
								<Button
									type="button"
									variant="secondary"
									size="icon-sm"
									onClick={() => setImageDataUrl(null)}
									disabled={isSubmitting}
									aria-label="Remove attached image"
									className="absolute top-1.5 right-1.5"
								>
									<X />
								</Button>
							</div>
						) : (
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<ImageIcon className="size-4" />
								<span className="text-xs">
									Tip: paste a screenshot (Ctrl/Cmd+V) to attach it.
								</span>
							</div>
						)}
					</div>

					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => handleOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button onClick={handleSubmit} disabled={!canSubmit}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Sending" : "Send report"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
