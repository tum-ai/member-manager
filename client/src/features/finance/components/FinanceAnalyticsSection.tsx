import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactElement } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
	FinanceAnalyticsResponse,
	FinanceDateRange,
} from "@/features/finance/financeTypes";
import {
	formatBereichLabel,
	formatFinanceAmount,
	formatFinanceAmountCompact,
	formatFinanceMonth,
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
const INCOME_COLOR = "#10b981";
const EXPENSE_COLOR = "#ef4444";
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
const AXIS_TITLE = {
	fill: "var(--muted-foreground)",
	fontSize: 12,
	fontWeight: 500,
};
const GRID_STROKE = "var(--border)";
const MAX_DEPARTMENT_BARS = 10;

// Shared axis title config (recharts `label` prop) so every chart labels its
// value axis consistently.
function valueAxisLabel(text: string, axis: "x" | "y") {
	const position: "insideLeft" | "insideBottom" =
		axis === "y" ? "insideLeft" : "insideBottom";
	return {
		value: text,
		angle: axis === "y" ? -90 : 0,
		position,
		offset: axis === "y" ? 10 : -4,
		style: { ...AXIS_TITLE, textAnchor: "middle" as const },
	};
}

interface FinanceAnalyticsSectionProps {
	analytics?: FinanceAnalyticsResponse;
	range: FinanceDateRange;
	isLoading: boolean;
	isFetching: boolean;
	error: Error | null;
	onDateFromChange: (value: string) => void;
	onDateToChange: (value: string) => void;
	onRefresh: () => void;
}

export function FinanceAnalyticsSection({
	analytics,
	range,
	isLoading,
	isFetching,
	error,
	onDateFromChange,
	onDateToChange,
	onRefresh,
}: FinanceAnalyticsSectionProps): ReactElement {
	return (
		<div className="flex flex-col gap-5">
			<Controls
				range={range}
				isFetching={isFetching}
				source={analytics?.source}
				onDateFromChange={onDateFromChange}
				onDateToChange={onDateToChange}
				onRefresh={onRefresh}
			/>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			{analytics && analytics.totals.unmapped_count > 0 ? (
				<Alert>
					<AlertTriangle className="size-4" />
					<AlertDescription>
						{analytics.totals.unmapped_count} Buchung(en) haben eine noch nicht
						zugeordnete Kostenstelle und erscheinen unter „Nicht zugeordnet".
						Ordne sie im Tab „Zuordnung" einem Department zu.
					</AlertDescription>
				</Alert>
			) : null}

			<TotalsRow analytics={analytics} isLoading={isLoading} />

			<div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
				<ChartCard
					title="Ausgaben pro Department"
					description="Summe der Ausgaben je Department im Zeitraum."
				>
					{isLoading ? (
						<ChartSkeleton />
					) : (
						<DepartmentBars analytics={analytics} />
					)}
				</ChartCard>
				<ChartCard
					title="Ausgabenanteil"
					description="Verteilung der Ausgaben auf die Departments."
				>
					{isLoading ? (
						<ChartSkeleton />
					) : (
						<DepartmentPie analytics={analytics} />
					)}
				</ChartCard>
			</div>

			<ChartCard
				title="Einnahmen & Ausgaben pro Monat"
				description="Monatlicher Verlauf im gewählten Zeitraum."
			>
				{isLoading ? <ChartSkeleton /> : <MonthlyTrend analytics={analytics} />}
			</ChartCard>

			<BereichBreakdown analytics={analytics} isLoading={isLoading} />
		</div>
	);
}

function Controls({
	range,
	isFetching,
	source,
	onDateFromChange,
	onDateToChange,
	onRefresh,
}: {
	range: FinanceDateRange;
	isFetching: boolean;
	source?: "mock" | "real";
	onDateFromChange: (value: string) => void;
	onDateToChange: (value: string) => void;
	onRefresh: () => void;
}): ReactElement {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-analytics-from">Von</Label>
				<Input
					id="finance-analytics-from"
					type="date"
					value={range.dateFrom}
					onChange={(event) => onDateFromChange(event.target.value)}
					className="w-40"
				/>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor="finance-analytics-to">Bis</Label>
				<Input
					id="finance-analytics-to"
					type="date"
					value={range.dateTo}
					onChange={(event) => onDateToChange(event.target.value)}
					className="w-40"
				/>
			</div>
			<Button
				type="button"
				variant="outline"
				onClick={onRefresh}
				disabled={isFetching}
			>
				<RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
				Aktualisieren
			</Button>
			{source ? (
				<Badge variant={source === "real" ? "default" : "secondary"}>
					{source === "real" ? "Live-Daten" : "Testdaten"}
				</Badge>
			) : null}
		</div>
	);
}

function TotalsRow({
	analytics,
	isLoading,
}: {
	analytics?: FinanceAnalyticsResponse;
	isLoading: boolean;
}): ReactElement {
	const totals = analytics?.totals;
	const metrics = [
		{
			label: "Einnahmen",
			value: formatFinanceAmount(totals?.income ?? 0),
			className: "text-emerald-700 dark:text-emerald-400",
		},
		{
			label: "Ausgaben",
			value: formatFinanceAmount(totals?.expenses ?? 0),
			className: "text-destructive",
		},
		{
			label: "Netto",
			value: formatFinanceAmount(totals?.net ?? 0),
			className:
				(totals?.net ?? 0) >= 0
					? "text-emerald-700 dark:text-emerald-400"
					: "text-destructive",
		},
		{
			label: "Buchungen",
			value: String(totals?.count ?? 0),
			className: "text-foreground",
		},
	];

	return (
		<section
			aria-label="Finanzkennzahlen"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
		>
			{metrics.map((metric) => (
				<Card key={metric.label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{metric.label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<Skeleton className="h-8 w-28" />
						) : (
							<p
								className={`text-2xl font-semibold tabular-nums ${metric.className}`}
							>
								{metric.value}
							</p>
						)}
					</CardContent>
				</Card>
			))}
		</section>
	);
}

function DepartmentBars({
	analytics,
}: {
	analytics?: FinanceAnalyticsResponse;
}): ReactElement {
	const data = (analytics?.by_department ?? [])
		.filter((entry) => entry.expenses > 0)
		.slice(0, MAX_DEPARTMENT_BARS)
		.map((entry) => ({
			department: entry.department,
			expenses: entry.expenses,
		}));

	if (data.length === 0) {
		return <EmptyChart />;
	}

	// Grow the plot height with the number of bars so labels never crowd.
	const height = Math.max(280, data.length * 42 + 60);

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart
				data={data}
				layout="vertical"
				margin={{ top: 8, left: 8, right: 56, bottom: 24 }}
				barCategoryGap="22%"
			>
				<defs>
					{data.map((entry, index) => (
						<linearGradient
							key={entry.department}
							id={`bar-grad-${index}`}
							x1="0"
							y1="0"
							x2="1"
							y2="0"
						>
							<stop
								offset="0%"
								stopColor={CHART_COLORS[index % CHART_COLORS.length]}
								stopOpacity={0.55}
							/>
							<stop
								offset="100%"
								stopColor={CHART_COLORS[index % CHART_COLORS.length]}
								stopOpacity={1}
							/>
						</linearGradient>
					))}
				</defs>
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
					label={valueAxisLabel("Ausgaben (€)", "x")}
				/>
				<YAxis
					type="category"
					dataKey="department"
					width={150}
					tick={AXIS_TICK}
					tickLine={false}
					axisLine={false}
				/>
				<Tooltip
					cursor={{ fill: "var(--muted)", opacity: 0.4 }}
					formatter={(value) => [
						formatFinanceAmount(Number(value)),
						"Ausgaben",
					]}
					contentStyle={TOOLTIP_STYLE}
				/>
				<Bar dataKey="expenses" radius={[0, 6, 6, 0]} maxBarSize={30}>
					{data.map((entry, index) => (
						<Cell key={entry.department} fill={`url(#bar-grad-${index})`} />
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

function DepartmentPie({
	analytics,
}: {
	analytics?: FinanceAnalyticsResponse;
}): ReactElement {
	const data = (analytics?.by_department ?? [])
		.filter((entry) => entry.expenses > 0)
		.map((entry) => ({ name: entry.department, value: entry.expenses }));

	if (data.length === 0) {
		return <EmptyChart />;
	}

	const total = data.reduce((sum, entry) => sum + entry.value, 0);

	return (
		<ResponsiveContainer width="100%" height={320}>
			<PieChart>
				<Pie
					data={data}
					dataKey="value"
					nameKey="name"
					innerRadius={70}
					outerRadius={110}
					paddingAngle={2}
					stroke="var(--background)"
					strokeWidth={2}
					labelLine={false}
					label={({ percent }) => {
						const ratio = percent ?? 0;
						return ratio >= 0.06 ? `${Math.round(ratio * 100)}%` : "";
					}}
				>
					{data.map((entry, index) => (
						<Cell
							key={entry.name}
							fill={CHART_COLORS[index % CHART_COLORS.length]}
						/>
					))}
				</Pie>
				<Legend
					verticalAlign="bottom"
					iconType="circle"
					wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
				/>
				<Tooltip
					formatter={(value) => [
						`${formatFinanceAmount(Number(value))} (${Math.round(
							(Number(value) / total) * 100,
						)}%)`,
						"Ausgaben",
					]}
					contentStyle={TOOLTIP_STYLE}
				/>
			</PieChart>
		</ResponsiveContainer>
	);
}

function MonthlyTrend({
	analytics,
}: {
	analytics?: FinanceAnalyticsResponse;
}): ReactElement {
	const data = (analytics?.by_month ?? []).map((point) => ({
		month: formatFinanceMonth(point.month),
		Einnahmen: point.income,
		Ausgaben: point.expenses,
	}));

	if (data.length === 0) {
		return <EmptyChart />;
	}

	return (
		<ResponsiveContainer width="100%" height={300}>
			<AreaChart
				data={data}
				margin={{ top: 8, left: 12, right: 24, bottom: 24 }}
			>
				<defs>
					<linearGradient id="area-income" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.35} />
						<stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.02} />
					</linearGradient>
					<linearGradient id="area-expense" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.35} />
						<stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0.02} />
					</linearGradient>
				</defs>
				<CartesianGrid
					stroke={GRID_STROKE}
					strokeDasharray="3 3"
					vertical={false}
				/>
				<XAxis
					dataKey="month"
					tick={AXIS_TICK}
					tickLine={false}
					axisLine={{ stroke: GRID_STROKE }}
					label={valueAxisLabel("Monat", "x")}
				/>
				<YAxis
					tick={AXIS_TICK}
					tickLine={false}
					axisLine={false}
					width={72}
					tickFormatter={formatFinanceAmountCompact}
					label={valueAxisLabel("Betrag (€)", "y")}
				/>
				<Tooltip
					formatter={(value, name) => [
						formatFinanceAmount(Number(value)),
						name,
					]}
					contentStyle={TOOLTIP_STYLE}
				/>
				<Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
				<Area
					type="monotone"
					dataKey="Einnahmen"
					stroke={INCOME_COLOR}
					strokeWidth={2}
					fill="url(#area-income)"
					dot={{ r: 3, strokeWidth: 0, fill: INCOME_COLOR }}
					activeDot={{ r: 5 }}
				/>
				<Area
					type="monotone"
					dataKey="Ausgaben"
					stroke={EXPENSE_COLOR}
					strokeWidth={2}
					fill="url(#area-expense)"
					dot={{ r: 3, strokeWidth: 0, fill: EXPENSE_COLOR }}
					activeDot={{ r: 5 }}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function BereichBreakdown({
	analytics,
	isLoading,
}: {
	analytics?: FinanceAnalyticsResponse;
	isLoading: boolean;
}): ReactElement {
	if (isLoading) {
		return <ChartSkeleton />;
	}
	const rows = analytics?.by_bereich ?? [];
	if (rows.length === 0) {
		return <EmptyChart />;
	}

	return (
		<section
			aria-label="Auswertung nach Bereich"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
		>
			{rows.map((row) => (
				<Card key={row.bereich ?? "none"}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">
							{formatBereichLabel(row.bereich)}
						</CardTitle>
						<CardDescription>{row.count} Buchungen</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-1 text-sm">
						<Row label="Einnahmen" value={formatFinanceAmount(row.income)} />
						<Row label="Ausgaben" value={formatFinanceAmount(row.expenses)} />
						<Row label="Netto" value={formatFinanceAmount(row.net)} strong />
					</CardContent>
				</Card>
			))}
		</section>
	);
}

function Row({
	label,
	value,
	strong,
}: {
	label: string;
	value: string;
	strong?: boolean;
}): ReactElement {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			<span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>
				{value}
			</span>
		</div>
	);
}

function ChartCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactElement;
}): ReactElement {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function ChartSkeleton(): ReactElement {
	return <Skeleton className="h-[280px] w-full" />;
}

function EmptyChart(): ReactElement {
	return (
		<div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
			Keine Daten im gewählten Zeitraum.
		</div>
	);
}

const TOOLTIP_STYLE = {
	background: "var(--popover)",
	border: "1px solid var(--border)",
	borderRadius: "0.5rem",
	color: "var(--popover-foreground)",
} as const;
