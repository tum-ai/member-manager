import type { OwnMcpAccess } from "@member-manager/shared";
import { Bot } from "lucide-react";
import { InfoBox } from "@/components/ui/info-box";
import { Skeleton } from "@/components/ui/skeleton";

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
	if (isLoading) {
		return <Skeleton className="h-16 w-full rounded-xl" />;
	}
	if (hasError || !access) {
		return null;
	}
	const { summary, detail } = STATUS_TEXT[access.status](access.role);
	return (
		<InfoBox
			variant={access.status === "denied" ? "destructive" : "brand"}
			className="flex gap-3 p-4 text-sm"
			data-testid="notion-mcp-access-status"
		>
			<Bot className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
			<div>
				<p className="font-medium">Notion MCP access: {summary}</p>
				<p className="text-muted-foreground">{detail}</p>
			</div>
		</InfoBox>
	);
}
