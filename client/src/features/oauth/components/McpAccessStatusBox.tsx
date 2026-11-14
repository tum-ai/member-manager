import { Bot } from "lucide-react";
import { InfoBox } from "@/components/ui/info-box";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * "<Server> access: <summary>" on /connected-apps, one per TUM.ai MCP server.
 * Shows a skeleton while loading and nothing after an error.
 */
export function McpAccessStatusBox({
	label,
	summary,
	detail,
	isWarning,
	isLoading,
	hasError,
	testId,
}: {
	label: string;
	summary: string | null;
	detail: string;
	isWarning: boolean;
	isLoading: boolean;
	hasError: boolean;
	testId: string;
}): JSX.Element | null {
	if (isLoading) {
		return <Skeleton className="h-16 w-full rounded-xl" />;
	}
	if (hasError || summary === null) {
		return null;
	}
	return (
		<InfoBox
			variant={isWarning ? "destructive" : "brand"}
			className="flex gap-3 p-4 text-sm"
			data-testid={testId}
		>
			<Bot className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
			<div>
				<p className="font-medium">
					{label}: {summary}
				</p>
				<p className="text-muted-foreground">{detail}</p>
			</div>
		</InfoBox>
	);
}
