import {
	DEV_MCP_ROLES,
	type DevMcpAccessEntry,
	type DevMcpRole,
} from "@member-manager/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	DEFAULT_DEV_MCP_ROLE,
	DEV_MCP_ROLE_HINTS,
	DEV_MCP_ROLE_LABELS,
	describeDevMcpDecision,
} from "@/features/admin/adminDevMcpAccessUtils";
import { describeLastUse } from "@/features/admin/adminMcpAccessUtils";
import { getMemberStatusLabel } from "@/lib/memberMetadata";

export interface DevMcpAccessCardProps {
	entry: DevMcpAccessEntry;
	/** An action on this member is being saved. */
	isBusy: boolean;
	/** Tools dev-mcp marks destructive (delete, suspend, revoke). */
	destructiveTools: ReadonlySet<string>;
	onApprove: (role: DevMcpRole) => void;
	onSetRole: (role: DevMcpRole) => void;
	onEditTools: () => void;
	onSuspend: () => void;
	onDeny: () => void;
}

function RolePicker({
	name,
	value,
	disabled,
	onChange,
}: {
	name: string;
	value: DevMcpRole;
	disabled: boolean;
	onChange: (role: DevMcpRole) => void;
}): JSX.Element {
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			size="sm"
			value={value}
			// Clicking the selected item clears the group; keep the role instead.
			onValueChange={(next) => {
				if (next) onChange(next as DevMcpRole);
			}}
			disabled={disabled}
			aria-label={`Dev MCP role for ${name}`}
		>
			{DEV_MCP_ROLES.map((role) => (
				<ToggleGroupItem
					key={role}
					value={role}
					title={DEV_MCP_ROLE_HINTS[role]}
				>
					{DEV_MCP_ROLE_LABELS[role]}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

/**
 * One member's dev-mcp access: who they are, the last decision, their tools,
 * and the actions their status allows. A requested, suspended or denied
 * member is approved with the picked role (and its preset tools); an active
 * member's role changes as soon as another one is picked.
 */
export function DevMcpAccessCard({
	entry,
	isBusy,
	destructiveTools,
	onApprove,
	onSetRole,
	onEditTools,
	onSuspend,
	onDeny,
}: DevMcpAccessCardProps): JSX.Element {
	const [role, setRole] = useState<DevMcpRole>(
		entry.role ?? DEFAULT_DEV_MCP_ROLE,
	);
	const isActiveMember = entry.member_status === "active";
	const roleLabel = DEV_MCP_ROLE_LABELS[role].toLowerCase();

	return (
		<GlassCard className="flex flex-col gap-3 p-5">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate font-semibold">{entry.name}</p>
					<p className="text-sm text-muted-foreground">
						{entry.department ?? "No department"}
					</p>
				</div>
				{isActiveMember ? null : (
					<Badge variant="danger">
						{entry.member_status
							? getMemberStatusLabel(entry.member_status)
							: "No member status"}
					</Badge>
				)}
			</div>

			<div className="space-y-0.5 text-sm">
				<p>{describeDevMcpDecision(entry)}</p>
				{entry.decision_note ? (
					<p className="text-muted-foreground">Note: {entry.decision_note}</p>
				) : null}
				<p className="text-muted-foreground">{describeLastUse(entry)}</p>
			</div>

			{entry.status === "active" ? (
				<ul
					className="flex flex-wrap gap-1.5"
					aria-label={`Dev MCP tools of ${entry.name}`}
				>
					{entry.tools.length === 0 ? (
						<li className="text-sm text-muted-foreground">No tools granted</li>
					) : (
						entry.tools.map((tool) => (
							<li key={tool}>
								<Badge
									variant={destructiveTools.has(tool) ? "warning" : "neutral"}
								>
									{tool}
									{destructiveTools.has(tool) ? " (destructive)" : ""}
								</Badge>
							</li>
						))
					)}
				</ul>
			) : null}

			<div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
				{entry.status === "active" ? (
					<>
						<RolePicker
							name={entry.name}
							value={entry.role ?? DEFAULT_DEV_MCP_ROLE}
							disabled={isBusy}
							onChange={(next) => {
								if (next !== entry.role) onSetRole(next);
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onEditTools}
							disabled={isBusy}
							aria-label={`Edit Dev MCP tools for ${entry.name}`}
						>
							Edit tools
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onSuspend}
							disabled={isBusy}
							aria-label={`Suspend Dev MCP access for ${entry.name}`}
						>
							Suspend
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
							aria-label={`Approve ${entry.name} for Dev MCP as ${roleLabel}`}
						>
							{entry.status === "requested" ? "Approve" : "Approve again"} as{" "}
							{roleLabel}
						</Button>
						{entry.status === "requested" ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={onDeny}
								disabled={isBusy}
								aria-label={`Deny Dev MCP access for ${entry.name}`}
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
