import type React from "react";

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
	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				{description && (
					<p className="mt-1 text-muted-foreground">{description}</p>
				)}
			</div>

			{children}
		</div>
	);
}
