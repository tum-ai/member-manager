import type React from "react";
import { useSetPageHeader } from "@/contexts/PageHeaderContext";

interface ToolPageShellProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

export function ToolPageShell({
	title,
	description,
	children,
}: ToolPageShellProps): React.ReactElement {
	useSetPageHeader(title, description);
	return <>{children}</>;
}
