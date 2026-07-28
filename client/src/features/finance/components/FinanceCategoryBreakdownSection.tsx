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
import type { FinanceCategorySummary } from "@/features/finance/financeTypes";
import {
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
const MAX_CATEGORY_BARS = 10;
const TOOLTIP_STYLE = {
	background: "var(--popover)",
	border: "1px solid var(--border)",
	borderRadius: "0.5rem",
	color: "var(--popover-foreground)",
} as const;

interface FinanceCategoryBreakdownSectionProps {
	categories?: FinanceCategorySummary[];
	isLoading: boolean;
}

export function FinanceCategoryBreakdownSection({
	categories,
	isLoading,
}: FinanceCategoryBreakdownSectionProps): ReactElement {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Expenses by category</CardTitle>
				<CardDescription>
					Analysis by secondary cost center (Kostenstelle 2). Manage category
					labels in the "Mapping" tab.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-5">
				{isLoading ? (
					<Skeleton className="h-[280px] w-full" />
				) : (
					<>
						<CategoryBars categories={categories} />
						<CategoryTable categories={categories} />
					</>
				)}
			</CardContent>
		</Card>
	);
}

function CategoryBars({
	categories,
}: {
	categories?: FinanceCategorySummary[];
}): ReactElement {
	const data = (categories ?? [])
		.filter((entry) => entry.expenses > 0)
		.slice(0, MAX_CATEGORY_BARS)
		.map((entry) => ({ category: entry.category, expenses: entry.expenses }));

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
					dataKey="category"
					width={150}
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
							key={entry.category}
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

function CategoryTable({
	categories,
}: {
	categories?: FinanceCategorySummary[];
}): ReactElement | null {
	const rows = categories ?? [];
	if (rows.length === 0) {
		return null;
	}

	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Category</TableHead>
						<TableHead className="text-right">Income</TableHead>
						<TableHead className="text-right">Expenses</TableHead>
						<TableHead className="text-right">Net</TableHead>
						<TableHead className="text-right">Postings</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<TableRow key={row.category}>
							<TableCell className="font-medium">{row.category}</TableCell>
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
