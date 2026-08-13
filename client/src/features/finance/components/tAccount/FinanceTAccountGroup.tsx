import {
	CalendarPlus,
	ChevronDown,
	FolderClosed,
	FolderPlus,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	type TAccountColumnSummary,
	type TAccountDisplayLine,
	type TAccountNode,
	vatLabel,
} from "@/features/finance/financeTAccountUtils";
import { formatFinanceAmount } from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";
import { FinanceTAccountLineRow } from "./FinanceTAccountLineRow";
import type { TAccountInteraction } from "./tAccountInteraction";

// Colour a saldo the way the mockup reads it: profit (>= 0) positive, deficit
// negative. Colour is always backed by an explicit sign in the number, never
// colour alone, so it survives dark mode and colour-blind users (a11y).
function saldoClass(value: number): string {
	if (value > 0) return "text-emerald-600 dark:text-emerald-400";
	if (value < 0) return "text-destructive";
	return "text-foreground";
}

// Ist / Plan and the VAT embedded in each, named by the column's direction so
// reclaimable Vorsteuer is never confused with Umsatzsteuer owed (FR-N3).
function ColumnSubtotals({
	summary,
	direction,
}: {
	summary: TAccountColumnSummary;
	direction: "expense" | "income";
}): ReactElement {
	const label = vatLabel(direction);
	return (
		<dl className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-sm">
			<div className="flex items-baseline justify-between">
				<dt className="font-semibold">Ist</dt>
				<dd className="font-semibold tabular-nums">
					{formatFinanceAmount(summary.ist)}
				</dd>
			</div>
			<div className="flex items-baseline justify-between text-muted-foreground">
				<dt>Plan</dt>
				<dd className="tabular-nums">{formatFinanceAmount(summary.plan)}</dd>
			</div>
			<div className="flex items-baseline justify-between text-muted-foreground">
				<dt>{label}</dt>
				<dd className="tabular-nums">{formatFinanceAmount(summary.vatIst)}</dd>
			</div>
			{summary.vatPlan > 0 ? (
				<div className="flex items-baseline justify-between text-muted-foreground">
					<dt>{label} (geplant)</dt>
					<dd className="tabular-nums">
						{formatFinanceAmount(summary.vatPlan)}
					</dd>
				</div>
			) : null}
		</dl>
	);
}

function Column({
	title,
	direction,
	lines,
	summary,
	interaction,
}: {
	title: string;
	direction: "expense" | "income";
	lines: TAccountDisplayLine[];
	summary: TAccountColumnSummary;
	interaction?: TAccountInteraction;
}): ReactElement {
	const [showParked, setShowParked] = useState(false);
	const [showSettled, setShowSettled] = useState(false);
	const active = lines.filter((line) => line.isActive && !line.isSettled);
	const settled = lines.filter((line) => line.isActive && line.isSettled);
	const parked = lines.filter((line) => !line.isActive);

	return (
		<div className="min-w-0 flex-1">
			<h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h4>
			{active.length === 0 && parked.length === 0 && settled.length === 0 ? (
				<p className="py-1 text-sm text-muted-foreground">—</p>
			) : (
				<div className="divide-y divide-border/60">
					{active.map((line) => (
						<FinanceTAccountLineRow
							key={line.key}
							line={line}
							interaction={interaction}
						/>
					))}
				</div>
			)}
			{/* A Planposten whose invoices have all arrived is done, but still
			    editable — and since the plan tab retired (FR-O) this is the only
			    place it can be reached from. */}
			{settled.length > 0 ? (
				<Collapsible open={showSettled} onOpenChange={setShowSettled}>
					<CollapsibleTrigger className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
						<ChevronDown
							className={cn(
								"size-3.5 transition-transform",
								showSettled ? "rotate-0" : "-rotate-90",
							)}
							aria-hidden
						/>
						Erledigt ({settled.length})
					</CollapsibleTrigger>
					<CollapsibleContent className="divide-y divide-border/60">
						{settled.map((line) => (
							<FinanceTAccountLineRow
								key={line.key}
								line={line}
								interaction={interaction}
							/>
						))}
					</CollapsibleContent>
				</Collapsible>
			) : null}
			{/* A parked Planposten stays reachable — it can be revived from here —
			    but it is out of the way and out of every subtotal (FR-M3). */}
			{parked.length > 0 ? (
				<Collapsible open={showParked} onOpenChange={setShowParked}>
					<CollapsibleTrigger className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
						<ChevronDown
							className={cn(
								"size-3.5 transition-transform",
								showParked ? "rotate-0" : "-rotate-90",
							)}
							aria-hidden
						/>
						Deaktiviert ({parked.length})
					</CollapsibleTrigger>
					<CollapsibleContent className="divide-y divide-border/60">
						{parked.map((line) => (
							<FinanceTAccountLineRow
								key={line.key}
								line={line}
								interaction={interaction}
							/>
						))}
					</CollapsibleContent>
				</Collapsible>
			) : null}
			<ColumnSubtotals summary={summary} direction={direction} />
		</div>
	);
}

function SaldoFooter({ node }: { node: TAccountNode }): ReactElement {
	return (
		<div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border pt-2 text-sm">
			<span className="text-muted-foreground">
				Saldo Ist{" "}
				<span
					className={cn(
						"font-semibold tabular-nums",
						saldoClass(node.actualSaldo),
					)}
				>
					{formatFinanceAmount(node.actualSaldo)}
				</span>
			</span>
			{node.targetAmount !== null ? (
				<span className="text-muted-foreground">
					Abweichung zum Ziel{" "}
					<span
						className={cn(
							"font-semibold tabular-nums",
							saldoClass(node.deviation ?? 0),
						)}
					>
						{formatFinanceAmount(node.deviation ?? 0)}
					</span>
				</span>
			) : (
				<span className="text-muted-foreground">
					Forecast{" "}
					<span
						className={cn(
							"font-semibold tabular-nums",
							saldoClass(node.planSaldo),
						)}
					>
						{formatFinanceAmount(node.planSaldo)}
					</span>
				</span>
			)}
		</div>
	);
}

// FR-L3: every folder can grow a project in place. A department or sub-team
// folder creates a project; a project creates a sub-project under itself.
function NodeActions({
	node,
	interaction,
}: {
	node: TAccountNode;
	interaction?: TAccountInteraction;
}): ReactElement | null {
	if (interaction?.canWrite !== true) {
		return null;
	}
	const isProject = node.projectId !== null;
	return (
		<>
			<Button
				type="button"
				size="sm"
				variant="outline"
				onClick={() => interaction.onCreateProject(node)}
			>
				<FolderPlus />
				{isProject ? "Neues Teilprojekt" : "Neues Projekt"}
			</Button>
			{/* FR-M1: a Planposten is planned where the money will be spent, with
			    this node's project already filled in. */}
			<Button
				type="button"
				size="sm"
				variant="outline"
				onClick={() => interaction.onCreatePlanItem(node)}
			>
				<CalendarPlus />
				Neuer Planposten
			</Button>
		</>
	);
}

function NodeBody({
	node,
	interaction,
}: {
	node: TAccountNode;
	interaction?: TAccountInteraction;
}): ReactElement {
	return (
		<>
			<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
				<Column
					title="Ausgaben"
					direction="expense"
					lines={node.expenseLines}
					summary={node.expenseSummary}
					interaction={interaction}
				/>
				<div className="hidden w-px self-stretch bg-border sm:block" />
				<Column
					title="Einnahmen"
					direction="income"
					lines={node.incomeLines}
					summary={node.incomeSummary}
					interaction={interaction}
				/>
			</div>
			<SaldoFooter node={node} />
			<div className="mt-3 flex flex-wrap gap-2">
				<NodeActions node={node} interaction={interaction} />
			</div>
			{node.children.length > 0 ? (
				<div className="mt-4 flex flex-col gap-4 border-l-2 border-border/60 pl-4">
					{node.children.map((child) => (
						<FinanceTAccountGroup
							key={child.key}
							node={child}
							interaction={interaction}
						/>
					))}
				</div>
			) : null}
		</>
	);
}

export function FinanceTAccountGroup({
	node,
	interaction,
}: {
	node: TAccountNode;
	interaction?: TAccountInteraction;
}): ReactElement {
	// Only the true unlabelled bucket (no project, no sub-team) renders open as
	// "Direkt zugeordnet". Sub-teams (project_id null but named, e.g. "Big
	// Makeathon") and projects both render as expandable folders.
	if (node.projectId === null && node.projectName === null) {
		return (
			<section
				aria-label="Direkt zugeordnet"
				className="rounded-lg border border-border bg-card p-4"
			>
				<h3 className="mb-2 text-sm font-semibold">Direkt zugeordnet</h3>
				<NodeBody node={node} interaction={interaction} />
			</section>
		);
	}
	return <ProjectGroup node={node} interaction={interaction} />;
}

function ProjectGroup({
	node,
	interaction,
}: {
	node: TAccountNode;
	interaction?: TAccountInteraction;
}): ReactElement {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
			// A named group, so the folder can be addressed as a whole — by a screen
			// reader moving between folders, and by anything that needs to act
			// inside one particular folder rather than the whole department.
			role="group"
			aria-label={node.projectName ?? "Projekt"}
			className="rounded-lg border border-border bg-card"
		>
			<CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-left">
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						open ? "rotate-0" : "-rotate-90",
					)}
					aria-hidden
				/>
				<FolderClosed
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
				<span className="min-w-0 flex-1 truncate font-semibold">
					{node.projectName ?? "Projekt"}
					{node.isSubTeam ? (
						<span className="ml-1.5 font-normal text-muted-foreground">
							Sub-Team
						</span>
					) : null}
				</span>
				{node.targetAmount !== null ? (
					<span className="text-sm text-muted-foreground">
						Zielsaldo{" "}
						<span className="font-semibold tabular-nums text-foreground">
							{formatFinanceAmount(node.targetAmount)}
						</span>
					</span>
				) : (
					<span className="text-sm text-muted-foreground">
						Profit{" "}
						<span
							className={cn(
								"font-semibold tabular-nums",
								saldoClass(node.actualSaldo),
							)}
						>
							{formatFinanceAmount(node.actualSaldo)}
						</span>
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent className="px-4 pb-4">
				<NodeBody node={node} interaction={interaction} />
			</CollapsibleContent>
		</Collapsible>
	);
}
