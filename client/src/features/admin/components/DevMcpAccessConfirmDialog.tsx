import { DEV_MCP_ACCESS_NOTE_MAX_LENGTH } from "@member-manager/shared";
import { AccessNoteConfirmDialog } from "@/features/admin/components/AccessNoteConfirmDialog";
import type { DevMcpAccessConfirmation } from "@/features/admin/hooks/useAdminDevMcpAccess";

const COPY = {
	deny: {
		title: (name: string) => `Deny ${name}'s Dev MCP request?`,
		description:
			"They can't use Dev Claude or connect Dev MCP from their AI apps. They can ask again, and you can approve them later.",
		confirm: "Deny",
	},
	suspend: {
		title: (name: string) => `Suspend ${name}'s Dev MCP access?`,
		description:
			"Dev Claude and their AI apps lose Dev MCP access within about a minute, and their tool grants are removed. You can approve them again later.",
		confirm: "Suspend",
	},
};

/** Confirms a dev-mcp suspend or deny, with an optional note only admins see. */
export function DevMcpAccessConfirmDialog({
	confirmation,
	onCancel,
	onConfirm,
}: {
	confirmation: DevMcpAccessConfirmation | null;
	onCancel: () => void;
	onConfirm: (note: string) => void;
}): JSX.Element {
	const copy = COPY[confirmation?.action ?? "deny"];
	return (
		<AccessNoteConfirmDialog
			open={confirmation !== null}
			title={copy.title(confirmation?.entry.name ?? "this member")}
			description={copy.description}
			confirmLabel={copy.confirm}
			noteMaxLength={DEV_MCP_ACCESS_NOTE_MAX_LENGTH}
			onCancel={onCancel}
			onConfirm={onConfirm}
		/>
	);
}
