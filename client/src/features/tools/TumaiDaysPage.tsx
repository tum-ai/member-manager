import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarCheck,
	CalendarDays,
	CalendarPlus,
	CalendarX,
	CircleSlash,
	Clock,
	Pencil,
	Search,
	Send,
	Trash2,
	Users,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import GlassCard from "../../components/ui/GlassCard";
import { useToast } from "../../contexts/ToastContext";
import { apiClient } from "../../lib/apiClient";
import ToolPageShell from "./ToolPageShell";

interface TumaiDayEvent {
	id: string;
	agenda: string;
	scheduled_at: string;
	sent_at: string | null;
	created_at: string;
}

interface RSVPResponse {
	userId: string;
	givenName: string;
	surname: string;
	email: string;
	department: string;
	status: "yes" | "no" | "pending";
	reason: string | null;
	votedAt: string | null;
}

interface EventResponsesPayload {
	event: TumaiDayEvent;
	stats: {
		yes: number;
		no: number;
		pending: number;
		total: number;
	};
	responses: RSVPResponse[];
}

export default function TumaiDaysPage(): ReactElement {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [agenda, setAgenda] = useState("");
	const [scheduledAt, setScheduledAt] = useState("");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [editingEventId, setEditingEventId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | "yes" | "no" | "pending"
	>("all");

	// Query: Fetch all events
	const {
		data: eventsData,
		isLoading: isLoadingEvents,
		error: eventsError,
	} = useQuery<{
		events: TumaiDayEvent[];
	}>({
		queryKey: ["tum-ai-days"],
		queryFn: async () => await apiClient("/api/tum-ai-days"),
	});

	// Query: Fetch responses for selected event
	const { data: responsesData, isLoading: isLoadingResponses } =
		useQuery<EventResponsesPayload>({
			queryKey: ["tum-ai-days-responses", selectedEventId],
			queryFn: async () =>
				await apiClient(`/api/tum-ai-days/${selectedEventId}/responses`),
			enabled: !!selectedEventId,
		});

	// Mutation: Create event
	const createEventMutation = useMutation<
		TumaiDayEvent,
		Error,
		{ agenda: string; scheduledAt: string }
	>({
		mutationFn: async (payload) =>
			await apiClient("/api/tum-ai-days", {
				method: "POST",
				body: JSON.stringify(payload),
			}),
		onSuccess: (newEvent) => {
			showToast("TUM.ai Day scheduled successfully!", "success");
			setAgenda("");
			setScheduledAt("");
			queryClient.invalidateQueries({ queryKey: ["tum-ai-days"] });
			setSelectedEventId(newEvent.id);
		},
		onError: (error) => {
			showToast(`Failed to schedule event: ${error.message}`, "error");
		},
	});

	// Mutation: Update event
	const updateEventMutation = useMutation<
		TumaiDayEvent,
		Error,
		{ id: string; agenda: string; scheduledAt: string }
	>({
		mutationFn: async ({ id, ...payload }) =>
			await apiClient(`/api/tum-ai-days/${id}`, {
				method: "PUT",
				body: JSON.stringify(payload),
			}),
		onSuccess: (updatedEvent) => {
			showToast("Event updated successfully!", "success");
			setAgenda("");
			setScheduledAt("");
			setEditingEventId(null);
			queryClient.invalidateQueries({ queryKey: ["tum-ai-days"] });
			setSelectedEventId(updatedEvent.id);
		},
		onError: (error) => {
			showToast(`Failed to update event: ${error.message}`, "error");
		},
	});

	// Mutation: Delete event
	const deleteEventMutation = useMutation<void, Error, string>({
		mutationFn: async (id) =>
			await apiClient(`/api/tum-ai-days/${id}`, {
				method: "DELETE",
			}),
		onSuccess: (_, deletedId) => {
			showToast("Event deleted successfully", "success");
			queryClient.invalidateQueries({ queryKey: ["tum-ai-days"] });
			if (selectedEventId === deletedId) {
				setSelectedEventId(null);
			}
		},
		onError: (error) => {
			showToast(`Failed to delete event: ${error.message}`, "error");
		},
	});

	// Mutation: Manual trigger dispatch
	const sendPendingMutation = useMutation<{ sentCount: number }, Error, void>({
		mutationFn: async () =>
			await apiClient("/api/tum-ai-days/send-pending", {
				method: "POST",
			}),
		onSuccess: (data) => {
			showToast(
				`Successfully dispatched ${data.sentCount} pending DMs!`,
				"success",
			);
			queryClient.invalidateQueries({ queryKey: ["tum-ai-days"] });
			if (selectedEventId) {
				queryClient.invalidateQueries({
					queryKey: ["tum-ai-days-responses", selectedEventId],
				});
			}
		},
		onError: (error) => {
			showToast(`Failed to send reminders: ${error.message}`, "error");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!agenda.trim() || !scheduledAt) {
			showToast("Please fill in both fields", "warning");
			return;
		}

		// Convert datetime-local string to ISO format
		const isoScheduledAt = new Date(scheduledAt).toISOString();

		if (editingEventId) {
			updateEventMutation.mutate({
				id: editingEventId,
				agenda,
				scheduledAt: isoScheduledAt,
			});
		} else {
			createEventMutation.mutate({ agenda, scheduledAt: isoScheduledAt });
		}
	};

	const handleStartEdit = (event: TumaiDayEvent, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingEventId(event.id);
		setAgenda(event.agenda);
		// Format the ISO scheduled_at into local YYYY-MM-DDTHH:MM format for the input
		const d = new Date(event.scheduled_at);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const hours = String(d.getHours()).padStart(2, "0");
		const minutes = String(d.getMinutes()).padStart(2, "0");
		setScheduledAt(`${year}-${month}-${day}T${hours}:${minutes}`);
	};

	const handleCancelEdit = () => {
		setEditingEventId(null);
		setAgenda("");
		setScheduledAt("");
	};

	const handleDelete = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (
			window.confirm(
				"Are you sure you want to delete this event? All associated RSVP data will be lost.",
			)
		) {
			deleteEventMutation.mutate(id);
		}
	};

	// Format display date
	const formatDate = (isoString: string) => {
		const d = new Date(isoString);
		return d.toLocaleString("en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		});
	};

	const events = eventsData?.events ?? [];
	const selectedEvent = events.find((e) => e.id === selectedEventId);

	// Filtering responses
	const filteredResponses = (responsesData?.responses ?? []).filter((r) => {
		const name = `${r.givenName} ${r.surname}`.toLowerCase();
		const matchesSearch =
			name.includes(searchTerm.toLowerCase()) ||
			r.email.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesFilter = statusFilter === "all" || r.status === statusFilter;
		return matchesSearch && matchesFilter;
	});

	// Share of active members who have responded (yes or no) so far.
	const stats = responsesData?.stats;
	const responseRate =
		stats && stats.total > 0
			? Math.round(((stats.yes + stats.no) / stats.total) * 100)
			: 0;

	return (
		<ToolPageShell
			title="TUM.ai Days RSVP"
			description="Schedule quarterly community gatherings, send Slack DMs, and audit responses."
		>
			<div className="grid grid-cols-1 gap-5 md:grid-cols-12">
				{/* Scheduling Form & Events List */}
				<div className="md:col-span-5">
					<div className="flex flex-col gap-5 md:sticky md:top-4 md:self-start">
						{/* Form Card */}
						<GlassCard>
							<div className="p-5">
								<div className="mb-4 flex items-center gap-2.5">
									<span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
										{editingEventId ? (
											<Pencil className="size-4" />
										) : (
											<CalendarPlus className="size-4" />
										)}
									</span>
									<div className="leading-tight">
										<h2 className="text-sm font-semibold">
											{editingEventId ? "Edit Event" : "Schedule Event"}
										</h2>
										<p className="text-xs text-muted-foreground">
											{editingEventId
												? "Update the agenda or send time."
												: "Plan the next TUM.ai Day gathering."}
										</p>
									</div>
								</div>
								<form onSubmit={handleSubmit} className="grid gap-3">
									<div className="grid min-w-0 gap-1.5">
										<Label htmlFor="event-agenda">Event Agenda</Label>
										<Textarea
											id="event-agenda"
											rows={4}
											value={agenda}
											onChange={(e) => setAgenda(e.target.value)}
											placeholder="Introduce the TUM.ai Day agenda, location, and important notes..."
											required
										/>
									</div>
									<div className="grid min-w-0 gap-1.5">
										<Label htmlFor="event-scheduled-at">
											Schedule Slack Send Time
										</Label>
										<Input
											id="event-scheduled-at"
											type="datetime-local"
											value={scheduledAt}
											onChange={(e) => setScheduledAt(e.target.value)}
											required
										/>
									</div>
									<div className="mt-1 flex flex-row gap-2">
										<Button
											type="submit"
											disabled={
												createEventMutation.isPending ||
												updateEventMutation.isPending
											}
											className="flex-grow"
										>
											<CalendarDays className="size-4" />
											{editingEventId
												? updateEventMutation.isPending
													? "Updating..."
													: "Update Event"
												: createEventMutation.isPending
													? "Scheduling..."
													: "Schedule Event"}
										</Button>
										{editingEventId && (
											<Button
												type="button"
												variant="outline"
												onClick={handleCancelEdit}
											>
												Cancel
											</Button>
										)}
									</div>
								</form>
							</div>
						</GlassCard>

						{/* Events List Card */}
						<GlassCard>
							<div className="p-5">
								<div className="mb-3 flex flex-row items-center justify-between">
									<h3 className="text-sm font-semibold">Scheduled Events</h3>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => sendPendingMutation.mutate()}
										disabled={sendPendingMutation.isPending}
										className="text-muted-foreground"
									>
										<Send className="size-3.5" />
										Check Scheduler
									</Button>
								</div>

								{isLoadingEvents ? (
									<div className="flex flex-col gap-2">
										{["a", "b", "c"].map((key) => (
											<Skeleton
												key={key}
												className="h-[68px] w-full rounded-lg"
											/>
										))}
									</div>
								) : eventsError ? (
									<Alert variant="destructive">
										<AlertDescription>Failed to load events.</AlertDescription>
									</Alert>
								) : events.length === 0 ? (
									<p className="py-6 text-center text-sm text-muted-foreground">
										No scheduled events. Create one above!
									</p>
								) : (
									<div className="flex flex-col gap-2">
										{events.map((event) => {
											const isSelected = event.id === selectedEventId;
											const isSent = !!event.sent_at;
											const isPast = new Date(event.scheduled_at) <= new Date();

											return (
												// biome-ignore lint/a11y/useSemanticElements: row hosts nested edit/delete buttons, so it can't be a <button>
												<div
													role="button"
													tabIndex={0}
													key={event.id}
													onClick={() => setSelectedEventId(event.id)}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															setSelectedEventId(event.id);
														}
													}}
													className={cn(
														"group relative w-full cursor-pointer overflow-hidden rounded-lg border p-3.5 pl-4 text-left transition-colors",
														isSelected
															? "border-brand/60 bg-brand/5"
															: "border-border bg-transparent hover:border-brand/30 hover:bg-brand/[0.03]",
													)}
												>
													<span
														className={cn(
															"absolute inset-y-0 left-0 w-0.5 transition-colors",
															isSelected
																? "bg-brand"
																: "bg-transparent group-hover:bg-brand/30",
														)}
													/>
													<div className="flex flex-row items-start justify-between gap-3">
														<div className="min-w-0 flex-1">
															<p className="truncate text-sm font-medium leading-tight">
																{event.agenda}
															</p>
															<span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
																<Clock className="size-3" />
																{formatDate(event.scheduled_at)}
															</span>
															<div className="mt-1.5 flex flex-row gap-2">
																{isSent ? (
																	<Badge variant="success" className="gap-1">
																		<Send className="size-2.5" />
																		Sent {formatDate(event.sent_at as string)}
																	</Badge>
																) : isPast ? (
																	<Badge variant="warning" className="gap-1">
																		<span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
																		Pending Send
																	</Badge>
																) : (
																	<Badge variant="accent" className="gap-1">
																		<CalendarDays className="size-2.5" />
																		Scheduled
																	</Badge>
																)}
															</div>
														</div>
														<div className="flex flex-row items-center gap-1">
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon-sm"
																			onClick={(e) => handleStartEdit(event, e)}
																			className="text-muted-foreground hover:text-foreground"
																			aria-label="Edit Event"
																		>
																			<Pencil className="size-4" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>Edit Event</TooltipContent>
																</Tooltip>
															</TooltipProvider>
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon-sm"
																			onClick={(e) => handleDelete(event.id, e)}
																			className="text-destructive hover:text-destructive"
																			aria-label="Delete Event"
																		>
																			<Trash2 className="size-4" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>Delete Event</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</GlassCard>
					</div>
				</div>

				{/* Audit RSVP Responses View */}
				<div className="md:col-span-7">
					<GlassCard className="h-full">
						<div className="p-5">
							{!selectedEventId ? (
								<div className="flex min-h-[400px] flex-col items-center justify-center text-center">
									<span className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
										<CalendarCheck className="size-6" />
									</span>
									<h3 className="text-sm font-semibold">No event selected</h3>
									<p className="mt-1 max-w-xs text-xs text-muted-foreground">
										Pick an event from the list to see who's coming and audit
										every RSVP.
									</p>
								</div>
							) : isLoadingResponses ? (
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
									<AlertDescription>
										Failed to load RSVP details.
									</AlertDescription>
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
											<Label htmlFor="rsvp-search">
												Search by Name or Email
											</Label>
											<div className="relative">
												<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
												<Input
													id="rsvp-search"
													value={searchTerm}
													onChange={(e) => setSearchTerm(e.target.value)}
													placeholder="Search members…"
													className="pl-9"
												/>
											</div>
										</div>
										<div className="grid min-w-0 gap-2 sm:min-w-[160px]">
											<Label htmlFor="rsvp-status-filter">
												Response Status
											</Label>
											<Select
												value={statusFilter}
												onValueChange={(value) =>
													setStatusFilter(
														value as "all" | "yes" | "no" | "pending",
													)
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
													<TableHead className="font-semibold">
														Member
													</TableHead>
													<TableHead className="font-semibold">
														Department
													</TableHead>
													<TableHead className="font-semibold">
														Status
													</TableHead>
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
																<span className="text-sm">
																	No matches found.
																</span>
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
																		(row.status === "no"
																			? "No reason given"
																			: "—")}
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
				</div>
			</div>
		</ToolPageShell>
	);
}
