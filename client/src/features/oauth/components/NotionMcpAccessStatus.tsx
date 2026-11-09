import type { OwnMcpAccess } from "@member-manager/shared";
import { McpAccessStatusBox } from "@/features/oauth/components/McpAccessStatusBox";

const STATUS_TEXT: Record<
	OwnMcpAccess["status"],
	(role: OwnMcpAccess["role"]) => { summary: string; detail: string }
> = {
	none: () => ({
		summary: "not requested yet",
		detail:
			"Connect an AI app to the TUM.ai Notion MCP to ask the admins for access.",
	}),
	pending: () => ({
		summary: "waiting for approval",
		detail: "An admin will review your request.",
	}),
	approved: (role) => ({
		summary: `approved as ${role ?? "editor"}`,
		detail:
			role === "reader"
				? "Your AI apps can search and read TUM.ai's Notion workspace."
				: "Your AI apps can read and edit TUM.ai's Notion workspace as you.",
	}),
	denied: () => ({
		summary: "declined",
		detail: "Ask an admin if you think this is a mistake.",
	}),
};

/** "Notion MCP access: …" on /connected-apps. */
export function NotionMcpAccessStatus({
	access,
	isLoading,
	hasError,
}: {
	access: OwnMcpAccess | null;
	isLoading: boolean;
	hasError: boolean;
}): JSX.Element | null {
	const text = access ? STATUS_TEXT[access.status](access.role) : null;
	return (
		<McpAccessStatusBox
			label="Notion MCP access"
			summary={text?.summary ?? null}
			detail={text?.detail ?? ""}
			isWarning={access?.status === "denied"}
			isLoading={isLoading}
			hasError={hasError}
			testId="notion-mcp-access-status"
		/>
	);
}
