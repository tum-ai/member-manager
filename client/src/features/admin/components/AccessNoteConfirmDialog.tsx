import { useEffect, useId, useState } from "react";
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

export interface AccessNoteConfirmDialogProps {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	noteMaxLength: number;
	onCancel: () => void;
	onConfirm: (note: string) => void;
}

/**
 * Confirms taking access away (deny, revoke, suspend), with an optional note
 * only admins see. Shared by the Notion and Dev tabs of /admin/mcp-access.
 */
export function AccessNoteConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	noteMaxLength,
	onCancel,
	onConfirm,
}: AccessNoteConfirmDialogProps): JSX.Element {
	const [note, setNote] = useState("");
	const noteId = useId();

	// Start every confirmation with an empty note.
	useEffect(() => {
		if (open) setNote("");
	}, [open]);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onCancel();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor={noteId}>Note for admins (optional)</Label>
					<Textarea
						id={noteId}
						value={note}
						maxLength={noteMaxLength}
						onChange={(event) => setNote(event.target.value)}
						placeholder="Why, for whoever looks at this later"
					/>
				</div>
				<DialogFooter>
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() => onConfirm(note)}
					>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
