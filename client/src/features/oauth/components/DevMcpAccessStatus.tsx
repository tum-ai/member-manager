import type { OwnDevMcpAccess } from "@member-manager/shared";
import { McpAccessStatusBox } from "@/features/oauth/components/McpAccessStatusBox";

function describe(access: OwnDevMcpAccess): {
	summary: string;
	detail: string;
} {
	switch (access.status) {
		case "none":
			return {
				summary: "not requested yet",
				detail:
					"Ask Dev Claude in Slack, or connect an AI app to Dev MCP, to ask the admins for access.",
			};
		case "requested":
			return {
				summary: "waiting for approval",
				detail: "An admin will review your request.",
			};
		case "active": {
			const tools = access.tools.length;
			return {
				summary: `active as ${access.role ?? "member"}`,
				detail:
					tools === 0
						? "No tools are granted yet; ask an admin."
						: `Dev Claude and your connected AI apps can use ${tools} tool${tools === 1 ? "" : "s"}: ${access.tools.join(", ")}.`,
			};
		}
		case "suspended":
			return {
				summary: "suspended",
				detail: "Ask an admin if you think this is a mistake.",
			};
		case "denied":
			return {
				summary: "declined",
				detail: "You can ask Dev Claude for access again.",
			};
	}
}

/** "Dev MCP access: …" on /connected-apps (dev-mcp, Dev Claude's tools). */
export function DevMcpAccessStatus({
	access,
	isLoading,
	hasError,
}: {
	access: OwnDevMcpAccess | null;
	isLoading: boolean;
	hasError: boolean;
}): JSX.Element | null {
	const text = access ? describe(access) : null;
	return (
		<McpAccessStatusBox
			label="Dev MCP access"
			summary={text?.summary ?? null}
			detail={text?.detail ?? ""}
			isWarning={access?.status === "denied" || access?.status === "suspended"}
			isLoading={isLoading}
			hasError={hasError}
			testId="dev-mcp-access-status"
		/>
	);
}
