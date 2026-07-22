import type { ReactElement } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { FinanceAccountSummary } from "@/features/finance/financeTypes";
import {
	formatFinanceAccount,
	formatFinanceAmount,
	formatFinanceAmountCompact,
} from "@/features/finance/financeUtils";

// Distinct palette that reads on both light and dark backgrounds.
const CHART_COLORS = [
	"#6366f1",
	"#0ea5e9",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#a855f7",
	"#14b8a6",
	"#ec4899",
] as const;
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const GRID_STROKE = "var(--border)";
const MAX_ACCOUNT_BARS = 10;
const TOOLTIP_STYLE = {
	background: "var(--popover)",
	border: "1px solid var(--border)",
	borderRadius: "0.5rem",
	color: "var(--popover-foreground)",
} as const;

// Bar/table label: prefer the human name, but always keep the account number
// visible so the SKR03 origin stays traceable.
function accountDisplayName(entry: FinanceAccountSummary): string {
	const account = formatFinanceAccount(entry.account);
	return entry.label ? `${account} · ${entry.label}` : account;
}

interface FinanceAccountBreakdownSectionProps {
	accounts?: FinanceAccountSummary[];
	isLoading: boolean;
}

export function FinanceAccountBreakdownSection({
	accounts,
	isLoading,
}: FinanceAccountBreakdownSectionProps): ReactElement {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Expenses by account</CardTitle>
				<CardDescription>
					Analysis by SKR03 ledger account. Manage account labels in the
					"Mapping" tab.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{isLoading ? (
					<Skeleton className="h-[280px] w-full" />
				) : (
					<>
						<AccountBars accounts={accounts} />
						<AccountTable accounts={accounts} />
					</>
				)}
			</CardContent>
		</Card>
	);
}

function AccountBars({
	accounts,
}: {
	accounts?: FinanceAccountSummary[];
}): ReactElement {
	const data = (accounts ?? [])
		.filter((entry) => entry.expenses > 0)
		.slice(0, MAX_ACCOUNT_BARS)
		.map((entry) => ({
			account: accountDisplayName(entry),
			expenses: entry.expenses,
		}));

	if (data.length === 0) {
		return (
			<div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
				No expenses for the selected period.
			</div>
		);
	}

	const height = Math.max(280, data.length * 42 + 60);

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart
				data={data}
				layout="vertical"
				margin={{ top: 8, left: 8, right: 56, bottom: 8 }}
				barCategoryGap="22%"
			>
				<CartesianGrid
					horizontal={false}
					stroke={GRID_STROKE}
					strokeDasharray="3 3"
				/>
				<XAxis
					type="number"
					tick={AXIS_TICK}
					tickLine={false}
					axisLine={{ stroke: GRID_STROKE }}
					tickFormatter={formatFinanceAmountCompact}
				/>
				<YAxis
					type="category"
					dataKey="account"
					width={170}
					tick={AXIS_TICK}
					tickLine={false}
					axisLine={false}
				/>
				<Tooltip
					cursor={{ fill: "var(--muted)", opacity: 0.4 }}
					formatter={(value) => [
						formatFinanceAmount(Number(value)),
						"Expenses",
					]}
					contentStyle={TOOLTIP_STYLE}
				/>
				<Bar dataKey="expenses" radius={[0, 6, 6, 0]} maxBarSize={30}>
					{data.map((entry, index) => (
						<Cell
							key={entry.account}
							fill={CHART_COLORS[index % CHART_COLORS.length]}
						/>
					))}
					<LabelList
						dataKey="expenses"
						position="right"
						formatter={(value) => formatFinanceAmountCompact(Number(value))}
						style={{ fill: "var(--foreground)", fontSize: 12 }}
					/>
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

function AccountTable({
	accounts,
}: {
	accounts?: FinanceAccountSummary[];
}): ReactElement | null {
	const rows = accounts ?? [];
	if (rows.length === 0) {
		return null;
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Account</TableHead>
						<TableHead>Label</TableHead>
						<TableHead className="text-right">Income</TableHead>
						<TableHead className="text-right">Expenses</TableHead>
						<TableHead className="text-right">Net</TableHead>
						<TableHead className="text-right">Postings</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.account}>
							<TableCell className="font-medium tabular-nums">
								{formatFinanceAccount(row.account)}
							</TableCell>
							<TableCell className="text-muted-foreground">
								{row.label ?? "—"}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.income)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.expenses)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{formatFinanceAmount(row.net)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{row.count}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
