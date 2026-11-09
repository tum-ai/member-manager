import { MCP_ACCESS_NOTE_MAX_LENGTH } from "@member-manager/shared";
import { AccessNoteConfirmDialog } from "@/features/admin/components/AccessNoteConfirmDialog";
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

/** Confirms a nomcp deny or revoke, with an optional note only admins see. */
export function McpAccessConfirmDialog({
	confirmation,
	onCancel,
	onConfirm,
}: {
	confirmation: McpAccessConfirmation | null;
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
			noteMaxLength={MCP_ACCESS_NOTE_MAX_LENGTH}
			onCancel={onCancel}
			onConfirm={onConfirm}
		/>
	);
}
