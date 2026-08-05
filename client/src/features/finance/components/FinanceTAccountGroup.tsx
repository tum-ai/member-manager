import { ChevronDown, FolderClosed } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
	TAccountColumnSummary,
	TAccountDisplayLine,
	TAccountNode,
} from "@/features/finance/financeTAccountUtils";
import { formatFinanceAmount } from "@/features/finance/financeUtils";
import { cn } from "@/lib/utils";

// Colour a saldo the way the mockup reads it: profit (>= 0) positive, deficit
// negative. Colour is always backed by an explicit sign in the number, never
// colour alone, so it survives dark mode and colour-blind users (a11y).
function saldoClass(value: number): string {
	if (value > 0) return "text-emerald-600 dark:text-emerald-400";
	if (value < 0) return "text-destructive";
	return "text-foreground";
}

function AmountWithVat({ line }: { line: TAccountDisplayLine }): ReactElement {
	const amount = (
		<span className="tabular-nums">{formatFinanceAmount(line.amount)}</span>
	);
	if (line.direction !== "income" || !line.vatAmount || line.vatAmount <= 0) {
		return amount;
	}
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="cursor-help tabular-nums underline decoration-dotted underline-offset-2"
						aria-label={`${formatFinanceAmount(line.amount)}, enthält ${formatFinanceAmount(line.vatAmount)} Umsatzsteuer`}
					>
						{formatFinanceAmount(line.amount)}
					</button>
				</TooltipTrigger>
				<TooltipContent>
					enthält {formatFinanceAmount(line.vatAmount)} USt
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function LineRow({ line }: { line: TAccountDisplayLine }): ReactElement {
	const isPlan = line.kind === "plan";
	return (
		<div
			className={cn(
				"flex items-baseline justify-between gap-3 py-1 text-sm",
				isPlan && "text-muted-foreground",
			)}
		>
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
				{line.isProjectRollup ? (
					<FolderClosed
						className="size-3.5 shrink-0 self-center text-muted-foreground"
						aria-hidden
					/>
				) : null}
				<span className="truncate font-medium">{line.label}</span>
				{line.category ? (
					<span className="text-xs text-muted-foreground">
						· {line.category}
					</span>
				) : null}
				{isPlan ? (
					<Badge variant="neutral" className="ml-0.5">
						Geplant
					</Badge>
				) : null}
			</div>
			<AmountWithVat line={line} />
		</div>
	);
}

function ColumnSubtotals({
	summary,
}: {
	summary: TAccountColumnSummary;
}): ReactElement {
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
		</dl>
	);
}

function Column({
	title,
	lines,
	summary,
}: {
	title: string;
	lines: TAccountDisplayLine[];
	summary: TAccountColumnSummary;
}): ReactElement {
	return (
		<div className="min-w-0 flex-1">
			<h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h4>
			{lines.length === 0 ? (
				<p className="py-1 text-sm text-muted-foreground">—</p>
			) : (
				<div className="divide-y divide-border/60">
					{lines.map((line) => (
						<LineRow key={line.key} line={line} />
					))}
				</div>
			)}
			<ColumnSubtotals summary={summary} />
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

function NodeBody({ node }: { node: TAccountNode }): ReactElement {
	return (
		<>
			<div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
				<Column
					title="Ausgaben"
					lines={node.expenseLines}
					summary={node.expenseSummary}
				/>
				<div className="hidden w-px self-stretch bg-border sm:block" />
				<Column
					title="Einnahmen"
					lines={node.incomeLines}
					summary={node.incomeSummary}
				/>
			</div>
			<SaldoFooter node={node} />
			{node.children.length > 0 ? (
				<div className="mt-4 flex flex-col gap-4 border-l-2 border-border/60 pl-4">
					{node.children.map((child) => (
						<FinanceTAccountGroup
							key={child.projectId ?? child.projectName ?? "__ungrouped__"}
							node={child}
						/>
					))}
				</div>
			) : null}
		</>
	);
}

export function FinanceTAccountGroup({
	node,
}: {
	node: TAccountNode;
}): ReactElement {
	// Only the true unlabelled bucket (no project, no sub-team) renders open as
	// "Direkt zugeordnet". Sub-teams (project_id null but named, e.g. "Big
	// Makeathon") and projects both render as expandable folders.
	if (node.projectId === null && node.projectName === null) {
		return (
			<section className="rounded-lg border border-border bg-card p-4">
				<h3 className="mb-2 text-sm font-semibold">Direkt zugeordnet</h3>
				<NodeBody node={node} />
			</section>
		);
	}
	return <ProjectGroup node={node} />;
}

function ProjectGroup({ node }: { node: TAccountNode }): ReactElement {
	const [open, setOpen] = useState(false);
	return (
		<Collapsible
			open={open}
			onOpenChange={setOpen}
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
				<NodeBody node={node} />
			</CollapsibleContent>
		</Collapsible>
	);
}
