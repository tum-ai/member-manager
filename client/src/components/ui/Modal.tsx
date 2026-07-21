import type React from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
	title: string;
	onClose: () => void;
	children: React.ReactNode;
	onConfirm: () => void;
	confirmDisabled?: boolean;
	confirmLabel?: string;
	maxWidth?: "xs" | "sm" | "md" | "lg";
}

const maxWidthClasses: Record<NonNullable<ModalProps["maxWidth"]>, string> = {
	xs: "sm:max-w-sm",
	sm: "sm:max-w-md",
	md: "sm:max-w-2xl",
	lg: "sm:max-w-4xl",
};

// shadcn Dialog shim that preserves the previous MUI `Modal` API for callers
// such as the profile agreement flows.
export function Modal({
	title,
	onClose,
	children,
	onConfirm,
	confirmDisabled = false,
	confirmLabel = "Confirm",
	maxWidth = "md",
}: ModalProps) {
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				className={cn(
					"flex max-h-[90vh] flex-col gap-0 p-0",
					maxWidthClasses[maxWidth],
					// Full-screen on mobile.
					"max-sm:h-full max-sm:max-h-full max-sm:max-w-full max-sm:rounded-none max-sm:border-0",
				)}
			>
				<DialogHeader className="border-b px-6 py-4 text-left">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					{children}
				</div>

				<DialogFooter className="border-t px-6 py-3">
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={confirmDisabled}>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
