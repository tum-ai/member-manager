import { Download, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	BuchhaltungsButlerTransaction,
	FinanceDirectionFilter,
	FinanceFilters,
} from "@/features/finance/financeTypes";
import {
	formatFinanceAmount,
	formatFinanceDate,
} from "@/features/finance/financeUtils";

interface BuchhaltungsButlerTransactionsSectionProps {
	filters: FinanceFilters;
	transactions: BuchhaltungsButlerTransaction[];
	source?: "mock" | "real";
	generatedAt?: string;
	isLoading: boolean;
	isFetching: boolean;
	error: Error | null;
	onDateFromChange: (value: string) => void;
	onDateToChange: (value: string) => void;
	onSearchTermChange: (value: string) => void;
	onDirectionChange: (value: FinanceDirectionFilter) => void;
	onRefresh: () => void;
	onExport: () => void;
}

export function BuchhaltungsButlerTransactionsSection({
	filters,
	transactions,
	source,
	generatedAt,
	isLoading,
	isFetching,
	error,
	onDateFromChange,
	onDateToChange,
	onSearchTermChange,
	onDirectionChange,
	onRefresh,
	onExport,
}: BuchhaltungsButlerTransactionsSectionProps): ReactElement {
	return (
		<Card>
			<CardHeader className="gap-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle>BuchhaltungsButler Postings</CardTitle>
							{source && (
								<Badge variant={source === "real" ? "success" : "neutral"}>
									{source === "real" ? "Real API" : "Mock data"}
								</Badge>
							)}
						</div>
						{generatedAt && (
							<p className="mt-1 text-sm text-muted-foreground">
								Loaded {formatFinanceDate(generatedAt)}
							</p>
						)}
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={onRefresh} disabled={isFetching}>
							<RefreshCw className={isFetching ? "animate-spin" : ""} />
							Refresh
						</Button>
						<Button
							variant="outline"
							onClick={onExport}
							disabled={transactions.length === 0}
						>
							<Download />
							Export
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_12rem]">
					<div className="grid gap-2">
						<Label htmlFor="finance-date-from">From</Label>
						<Input
							id="finance-date-from"
							type="date"
							value={filters.dateFrom}
							onChange={(event) => onDateFromChange(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="finance-date-to">To</Label>
						<Input
							id="finance-date-to"
							type="date"
							value={filters.dateTo}
							onChange={(event) => onDateToChange(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="finance-search">Search</Label>
						<div className="relative">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="finance-search"
								value={filters.searchTerm}
								onChange={(event) => onSearchTermChange(event.target.value)}
								placeholder="Posting text, account, cost location"
								className="pl-9"
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="finance-direction">Type</Label>
						<Select value={filters.direction} onValueChange={onDirectionChange}>
							<SelectTrigger
								id="finance-direction"
								aria-label="Transaction Type"
								className="w-full"
							>
								<SlidersHorizontal className="size-4" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="income">Income</SelectItem>
								<SelectItem value="expenses">Expenses</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : isLoading ? (
					<div
						className="space-y-3"
						role="status"
						aria-label="Loading finance transactions"
					>
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : (
					<TransactionsTable transactions={transactions} />
				)}
			</CardContent>
		</Card>
	);
}

function TransactionsTable({
	transactions,
}: {
	transactions: BuchhaltungsButlerTransaction[];
}): ReactElement {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Date</TableHead>
					<TableHead>Posting</TableHead>
					<TableHead>Purpose</TableHead>
					<TableHead>Accounts</TableHead>
					<TableHead>Cost Locations</TableHead>
					<TableHead className="text-right">Amount</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{transactions.length === 0 ? (
					<TableRow>
						<TableCell
							colSpan={6}
							className="h-24 text-center text-muted-foreground"
						>
							No transactions match the current filters.
						</TableCell>
					</TableRow>
				) : (
					transactions.map((transaction) => (
						<TableRow key={transaction.external_id}>
							<TableCell>{formatFinanceDate(transaction.date)}</TableCell>
							<TableCell className="max-w-64 whitespace-normal font-medium">
								{transaction.postingtext}
							</TableCell>
							<TableCell className="max-w-72 whitespace-normal text-muted-foreground">
								{transaction.transaction_purpose || "Not provided"}
							</TableCell>
							<TableCell>
								{transaction.debit_postingaccount_number} /{" "}
								{transaction.credit_postingaccount_number}
							</TableCell>
							<TableCell>
								{transaction.cost_location}
								{transaction.cost_location_two
									? ` / ${transaction.cost_location_two}`
									: ""}
							</TableCell>
							<TableCell
								className={`text-right font-medium tabular-nums ${
									transaction.transaction_amount >= 0
										? "text-emerald-700 dark:text-emerald-400"
										: "text-destructive"
								}`}
							>
								{formatFinanceAmount(
									transaction.transaction_amount,
									transaction.currency,
								)}
							</TableCell>
						</TableRow>
					))
				)}
			</TableBody>
		</Table>
	);
}
