import { CalendarDays, Clock, Pencil, Send, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TumaiDayEvent } from "@/features/tools/tumaiDaysTypes";
import { formatDate } from "@/features/tools/tumaiDaysUtils";
import { cn } from "@/lib/utils";

interface TumaiDayEventListProps {
	events: TumaiDayEvent[];
	isLoading: boolean;
	hasError: boolean;
	selectedEventId: string | null;
	isSendPending: boolean;
	onSelectEvent: (id: string) => void;
	onSendPending: () => void;
	onStartEdit: (event: TumaiDayEvent, e: React.MouseEvent) => void;
	onDelete: (id: string, e: React.MouseEvent) => void;
}

export function TumaiDayEventList({
	events,
	isLoading,
	hasError,
	selectedEventId,
	isSendPending,
	onSelectEvent,
	onSendPending,
	onStartEdit,
	onDelete,
}: TumaiDayEventListProps): ReactElement {
	return (
		<GlassCard>
			<div className="p-5">
				<div className="mb-3 flex flex-row items-center justify-between">
					<h3 className="text-sm font-semibold">Scheduled Events</h3>
					<Button
						size="sm"
						variant="ghost"
						onClick={onSendPending}
						disabled={isSendPending}
						className="text-muted-foreground"
					>
						<Send className="size-3.5" />
						Check Scheduler
					</Button>
				</div>

				{isLoading ? (
					<div className="flex flex-col gap-2">
						{["a", "b", "c"].map((key) => (
							<Skeleton key={key} className="h-[68px] w-full rounded-lg" />
						))}
					</div>
				) : hasError ? (
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
									onClick={() => onSelectEvent(event.id)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											onSelectEvent(event.id);
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
															onClick={(e) => onStartEdit(event, e)}
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
															onClick={(e) => onDelete(event.id, e)}
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
	);
}
