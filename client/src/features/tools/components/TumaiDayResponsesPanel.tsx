import {
	CalendarCheck,
	CalendarX,
	CircleSlash,
	Clock,
	Search,
	Users,
} from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { InfoBox } from "@/components/ui/info-box";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { cn } from "@/lib/utils";
import { GlassCard } from "../../../components/ui/GlassCard";
import type {
	EventResponsesPayload,
	ResponseStatusFilter,
	RSVPResponse,
	TumaiDayEvent,
} from "../tumaiDaysTypes";

interface TumaiDayResponsesPanelProps {
	selectedEventId: string | null;
	isLoading: boolean;
	responsesData: EventResponsesPayload | undefined;
	selectedEvent: TumaiDayEvent | undefined;
	responseRate: number;
	filteredResponses: RSVPResponse[];
	searchTerm: string;
	onSearchTermChange: (value: string) => void;
	statusFilter: ResponseStatusFilter;
	onStatusFilterChange: (value: ResponseStatusFilter) => void;
}

export function TumaiDayResponsesPanel({
	selectedEventId,
	isLoading,
	responsesData,
	selectedEvent,
	responseRate,
	filteredResponses,
	searchTerm,
	onSearchTermChange,
	statusFilter,
	onStatusFilterChange,
}: TumaiDayResponsesPanelProps): ReactElement {
	return (
		<GlassCard className="h-full">
			<div className="p-5">
				{!selectedEventId ? (
					<div className="flex min-h-[400px] flex-col items-center justify-center text-center">
						<span className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
							<CalendarCheck className="size-6" />
						</span>
						<h3 className="text-sm font-semibold">No event selected</h3>
						<p className="mt-1 max-w-xs text-xs text-muted-foreground">
							Pick an event from the list to see who's coming and audit every
							RSVP.
						</p>
					</div>
				) : isLoading ? (
					<div className="flex flex-col gap-5">
						<Skeleton className="h-6 w-40" />
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{["a", "b", "c", "d"].map((key) => (
								<Skeleton key={key} className="h-[72px] rounded-lg" />
							))}
						</div>
						<Skeleton className="h-64 w-full rounded-lg" />
					</div>
				) : !responsesData ? (
					<Alert variant="destructive">
						<AlertDescription>Failed to load RSVP details.</AlertDescription>
					</Alert>
				) : (
					<div>
						{/* Event Header Summary */}
						<div className="mb-4 flex items-start gap-2.5">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
								<CalendarCheck className="size-4" />
							</span>
							<div className="min-w-0">
								<h3 className="text-sm font-semibold leading-tight">
									Audit Log
								</h3>
								<p className="mt-0.5 line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">
									{selectedEvent?.agenda}
								</p>
							</div>
						</div>

						{/* Response rate */}
						<InfoBox variant="muted" className="mb-4">
							<div className="mb-2 flex items-center justify-between">
								<span className="text-xs font-medium text-muted-foreground">
									Response rate ·{" "}
									{responsesData.stats.yes + responsesData.stats.no}/
									{responsesData.stats.total}
								</span>
								<span className="text-base font-semibold tabular-nums text-brand">
									{responseRate}%
								</span>
							</div>
							<Progress value={responseRate} className="h-1.5" />
						</InfoBox>

						{/* Stats Row */}
						<div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
							{(
								[
									{
										label: "Total",
										value: responsesData.stats.total,
										icon: Users,
										tint: "bg-brand/10 text-brand",
										valueClass: "text-foreground",
									},
									{
										label: "Attending",
										value: responsesData.stats.yes,
										icon: CalendarCheck,
										tint: "bg-green-500/10 text-green-600 dark:text-green-400",
										valueClass: "text-green-600 dark:text-green-400",
									},
									{
										label: "Declined",
										value: responsesData.stats.no,
										icon: CalendarX,
										tint: "bg-destructive/10 text-destructive",
										valueClass: "text-destructive",
									},
									{
										label: "Pending",
										value: responsesData.stats.pending,
										icon: Clock,
										tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
										valueClass: "text-amber-600 dark:text-amber-400",
									},
								] as const
							).map((stat) => (
								<InfoBox
									key={stat.label}
									variant="card"
									className="flex items-center gap-2.5 p-2.5"
								>
									<span
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-md",
											stat.tint,
										)}
									>
										<stat.icon className="size-3.5" />
									</span>
									<div className="min-w-0 leading-none">
										<p
											className={cn(
												"text-base font-semibold tabular-nums",
												stat.valueClass,
											)}
										>
											{stat.value}
										</p>
										<span className="text-xs text-muted-foreground">
											{stat.label}
										</span>
									</div>
								</InfoBox>
							))}
						</div>

						{/* Filters and Search */}
						<div className="mb-4 flex flex-col gap-3 sm:flex-row">
							<div className="grid w-full gap-2">
								<Label htmlFor="rsvp-search">Search by Name or Email</Label>
								<div className="relative">
									<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id="rsvp-search"
										value={searchTerm}
										onChange={(e) => onSearchTermChange(e.target.value)}
										placeholder="Search members…"
										className="pl-9"
									/>
								</div>
							</div>
							<div className="grid min-w-0 gap-2 sm:min-w-[160px]">
								<Label htmlFor="rsvp-status-filter">Response Status</Label>
								<Select
									value={statusFilter}
									onValueChange={(value) =>
										onStatusFilterChange(value as ResponseStatusFilter)
									}
								>
									<SelectTrigger
										id="rsvp-status-filter"
										className="w-full"
										aria-label="Response Status"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All responses</SelectItem>
										<SelectItem value="yes">Attending (Yes)</SelectItem>
										<SelectItem value="no">Declined (No)</SelectItem>
										<SelectItem value="pending">Pending</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Responses Table */}
						<div className="overflow-x-auto rounded-xl border">
							<Table>
								<TableHeader className="bg-muted/50">
									<TableRow className="hover:bg-transparent">
										<TableHead className="font-semibold">Member</TableHead>
										<TableHead className="font-semibold">Department</TableHead>
										<TableHead className="font-semibold">Status</TableHead>
										<TableHead className="font-semibold">
											Reason for Absence
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredResponses.length === 0 ? (
										<TableRow className="hover:bg-transparent">
											<TableCell colSpan={4} className="py-10">
												<div className="flex flex-col items-center gap-2 text-muted-foreground">
													<CircleSlash className="size-6 text-muted-foreground/40" />
													<span className="text-sm">No matches found.</span>
												</div>
											</TableCell>
										</TableRow>
									) : (
										filteredResponses.map((row) => (
											<TableRow key={row.userId}>
												<TableCell>
													<p className="text-sm font-bold">
														{row.givenName} {row.surname}
													</p>
													<span className="text-xs text-muted-foreground">
														{row.email}
													</span>
												</TableCell>
												<TableCell>{row.department}</TableCell>
												<TableCell>
													{row.status === "yes" ? (
														<Badge variant="success">Yes</Badge>
													) : row.status === "no" ? (
														<Badge variant="danger">No</Badge>
													) : (
														<Badge variant="warning">Pending</Badge>
													)}
												</TableCell>
												<TableCell>
													<p
														className={cn(
															"text-sm",
															row.reason
																? "text-foreground not-italic"
																: "text-muted-foreground italic",
														)}
													>
														{row.reason ||
															(row.status === "no" ? "No reason given" : "—")}
													</p>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</div>
		</GlassCard>
	);
}
