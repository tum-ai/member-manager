import type { McpAccessEntry, McpAccessRole } from "@member-manager/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	DEFAULT_MCP_ACCESS_ROLE,
	describeDecision,
	describeLastUse,
	MCP_ACCESS_ROLE_HINTS,
	MCP_ACCESS_ROLE_LABELS,
} from "@/features/admin/adminMcpAccessUtils";
import { getMemberStatusLabel } from "@/lib/memberMetadata";

export interface McpAccessCardProps {
	entry: McpAccessEntry;
	/** A decision on this member is being saved. */
	isBusy: boolean;
	onApprove: (role: McpAccessRole) => void;
	onSetRole: (role: McpAccessRole) => void;
	onDeny: () => void;
	onRevoke: () => void;
}

function RolePicker({
	name,
	value,
	disabled,
	onChange,
}: {
	name: string;
	value: McpAccessRole;
	disabled: boolean;
	onChange: (role: McpAccessRole) => void;
}): JSX.Element {
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			value={value}
			// Clicking the selected item clears the group; keep the role instead.
			onValueChange={(next) => {
				if (next) onChange(next as McpAccessRole);
			}}
			disabled={disabled}
			aria-label={`Notion MCP role for ${name}`}
		>
			{(["reader", "editor"] as const).map((role) => (
				<ToggleGroupItem
					key={role}
					value={role}
					title={MCP_ACCESS_ROLE_HINTS[role]}
				>
					{MCP_ACCESS_ROLE_LABELS[role]}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

/**
 * One member's nomcp access: who they are, the last decision, when they last
 * used it, and the actions their status allows. A pending or denied member is
 * approved with the picked role; an approved member's role changes as soon
 * as another one is picked.
 */
export function McpAccessCard({
	entry,
	isBusy,
	onApprove,
	onSetRole,
	onDeny,
	onRevoke,
}: McpAccessCardProps): JSX.Element {
	const [role, setRole] = useState<McpAccessRole>(
		entry.role ?? DEFAULT_MCP_ACCESS_ROLE,
	);
	const isActive = entry.member_status === "active";

	return (
		<GlassCard className="flex flex-col gap-3 p-5">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate font-semibold">{entry.name}</p>
					<p className="text-sm text-muted-foreground">
						{entry.department ?? "No department"}
					</p>
				</div>
				{isActive ? null : (
					<Badge variant="danger">
						{entry.member_status
							? getMemberStatusLabel(entry.member_status)
							: "No member status"}
					</Badge>
				)}
			</div>

			<div className="space-y-0.5 text-sm">
				<p>{describeDecision(entry)}</p>
				{entry.decision_note ? (
					<p className="text-muted-foreground">Note: {entry.decision_note}</p>
				) : null}
				<p className="text-muted-foreground">{describeLastUse(entry)}</p>
				{isActive ? null : (
					<p className="text-muted-foreground">
						nomcp refuses members who aren't active, whatever is decided here.
					</p>
				)}
			</div>

			<div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
				{entry.status === "approved" ? (
					<>
						<RolePicker
							name={entry.name}
							value={entry.role ?? DEFAULT_MCP_ACCESS_ROLE}
							disabled={isBusy}
							onChange={(next) => {
								if (next !== entry.role) onSetRole(next);
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onRevoke}
							disabled={isBusy}
							aria-label={`Revoke Notion MCP access for ${entry.name}`}
						>
							Revoke
						</Button>
					</>
				) : (
					<>
						<RolePicker
							name={entry.name}
							value={role}
							disabled={isBusy}
							onChange={setRole}
						/>
						<Button
							type="button"
							size="sm"
							onClick={() => onApprove(role)}
							disabled={isBusy}
							aria-label={`Approve ${entry.name} as ${role}`}
						>
							{entry.status === "denied" ? "Approve again" : "Approve"} as{" "}
							{role}
						</Button>
						{entry.status === "pending" ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onDeny}
								disabled={isBusy}
								aria-label={`Deny Notion MCP access for ${entry.name}`}
							>
								Deny
							</Button>
						) : null}
					</>
				)}
			</div>
		</GlassCard>
	);
}
