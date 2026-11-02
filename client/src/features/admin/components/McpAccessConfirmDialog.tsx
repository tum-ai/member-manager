import { MCP_ACCESS_NOTE_MAX_LENGTH } from "@member-manager/shared";
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
import type { McpAccessConfirmation } from "@/features/admin/hooks/useAdminMcpAccess";

const COPY = {
	deny: {
		title: (name: string) => `Deny ${name}'s request?`,
		description:
			"They can't use the TUM.ai Notion MCP from their AI apps. You can approve them later.",
		confirm: "Deny",
	},
	revoke: {
		title: (name: string) => `Revoke ${name}'s Notion MCP access?`,
		description:
			"Their AI apps lose access to TUM.ai's Notion within about a minute. You can approve them again later.",
		confirm: "Revoke",
	},
};

/** Confirms a deny or revoke, with an optional note only admins see. */
export function McpAccessConfirmDialog({
	confirmation,
	onCancel,
	onConfirm,
}: {
	confirmation: McpAccessConfirmation | null;
	onCancel: () => void;
	onConfirm: (note: string) => void;
}): JSX.Element {
	const [note, setNote] = useState("");
	const noteId = useId();
	const copy = COPY[confirmation?.action ?? "deny"];
	const name = confirmation?.entry.name ?? "this member";

	// Start every confirmation with an empty note.
	useEffect(() => {
		if (confirmation) setNote("");
	}, [confirmation]);

	return (
		<Dialog
			open={confirmation !== null}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{copy.title(name)}</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor={noteId}>Note for admins (optional)</Label>
					<Textarea
						id={noteId}
						value={note}
						maxLength={MCP_ACCESS_NOTE_MAX_LENGTH}
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
						{copy.confirm}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
