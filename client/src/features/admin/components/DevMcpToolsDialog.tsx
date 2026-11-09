import type {
	DevMcpAccessEntry,
	DevMcpCatalogTool,
} from "@member-manager/shared";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	DEFAULT_DEV_MCP_ROLE,
	devMcpToolChoices,
} from "@/features/admin/adminDevMcpAccessUtils";

/**
 * Edits an active member's dev-mcp tool grants. Only tools the member's role
 * allows are offered; destructive ones are flagged, as dev-mcp asks the
 * member to confirm each call in Slack. Saving sends exactly the ticked tools.
 */
export function DevMcpToolsDialog({
	entry,
	catalog,
	onCancel,
	onSave,
}: {
	/** The member whose tools are edited; null closes the dialog. */
	entry: DevMcpAccessEntry | null;
	catalog: readonly DevMcpCatalogTool[];
	onCancel: () => void;
	onSave: (tools: string[]) => void;
}): JSX.Element {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const idPrefix = useId();
	const role = entry?.role ?? DEFAULT_DEV_MCP_ROLE;
	const choices = devMcpToolChoices(role, catalog);

	// Start from the member's current grants each time the dialog opens.
	useEffect(() => {
		if (entry) setSelected(new Set(entry.tools));
	}, [entry]);

	const toggle = (tool: string, checked: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			if (checked) next.add(tool);
			else next.delete(tool);
			return next;
		});

	return (
		<Dialog
			open={entry !== null}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						Dev MCP tools for {entry?.name ?? "this member"}
					</DialogTitle>
					<DialogDescription>
						Tools a {role} may use. Changes apply to Dev Claude and connected AI
						apps within about a minute.
					</DialogDescription>
				</DialogHeader>
				{choices.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Dev MCP's tool list isn't available right now.
					</p>
				) : (
					<ul className="max-h-[60vh] space-y-3 overflow-y-auto">
						{choices.map((tool) => {
							const id = `${idPrefix}-${tool.name}`;
							return (
								<li key={tool.name} className="flex items-start gap-3">
									<Checkbox
										id={id}
										checked={selected.has(tool.name)}
										onCheckedChange={(checked) =>
											toggle(tool.name, checked === true)
										}
										className="mt-0.5"
									/>
									<div className="min-w-0 space-y-0.5">
										<Label htmlFor={id} className="flex flex-wrap gap-2">
											{tool.title}
											{tool.destructive ? (
												<Badge variant="warning">Destructive</Badge>
											) : null}
										</Label>
										<p className="text-xs text-muted-foreground">
											<code>{tool.name}</code>
											{tool.description ? ` · ${tool.description}` : ""}
										</p>
									</div>
								</li>
							);
						})}
					</ul>
				)}
				<DialogFooter>
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={choices.length === 0}
						onClick={() =>
							onSave(
								choices
									.map((tool) => tool.name)
									.filter((name) => selected.has(name)),
							)
						}
					>
						Save tools
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
