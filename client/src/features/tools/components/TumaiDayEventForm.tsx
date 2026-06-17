import { CalendarDays, CalendarPlus, Pencil } from "lucide-react";
import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard } from "../../../components/ui/GlassCard";

interface TumaiDayEventFormProps {
	agenda: string;
	onAgendaChange: (value: string) => void;
	scheduledAt: string;
	onScheduledAtChange: (value: string) => void;
	isEditing: boolean;
	isCreating: boolean;
	isUpdating: boolean;
	onSubmit: (e: React.FormEvent) => void;
	onCancelEdit: () => void;
}

export function TumaiDayEventForm({
	agenda,
	onAgendaChange,
	scheduledAt,
	onScheduledAtChange,
	isEditing,
	isCreating,
	isUpdating,
	onSubmit,
	onCancelEdit,
}: TumaiDayEventFormProps): ReactElement {
	return (
		<GlassCard>
			<div className="p-5">
				<div className="mb-4 flex items-center gap-2.5">
					<span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
						{isEditing ? (
							<Pencil className="size-4" />
						) : (
							<CalendarPlus className="size-4" />
						)}
					</span>
					<div className="leading-tight">
						<h2 className="text-sm font-semibold">
							{isEditing ? "Edit Event" : "Schedule Event"}
						</h2>
						<p className="text-xs text-muted-foreground">
							{isEditing
								? "Update the agenda or send time."
								: "Plan the next TUM.ai Day gathering."}
						</p>
					</div>
				</div>
				<form onSubmit={onSubmit} className="grid gap-3">
					<div className="grid min-w-0 gap-1.5">
						<Label htmlFor="event-agenda">Event Agenda</Label>
						<Textarea
							id="event-agenda"
							rows={4}
							value={agenda}
							onChange={(e) => onAgendaChange(e.target.value)}
							placeholder="Introduce the TUM.ai Day agenda, location, and important notes..."
							required
						/>
					</div>
					<div className="grid min-w-0 gap-1.5">
						<Label htmlFor="event-scheduled-at">Schedule Slack Send Time</Label>
						<Input
							id="event-scheduled-at"
							type="datetime-local"
							value={scheduledAt}
							onChange={(e) => onScheduledAtChange(e.target.value)}
							required
						/>
					</div>
					<div className="mt-1 flex flex-row gap-2">
						<Button
							type="submit"
							disabled={isCreating || isUpdating}
							className="flex-grow"
						>
							<CalendarDays className="size-4" />
							{isEditing
								? isUpdating
									? "Updating..."
									: "Update Event"
								: isCreating
									? "Scheduling..."
									: "Schedule Event"}
						</Button>
						{isEditing && (
							<Button type="button" variant="outline" onClick={onCancelEdit}>
								Cancel
							</Button>
						)}
					</div>
				</form>
			</div>
		</GlassCard>
	);
}
