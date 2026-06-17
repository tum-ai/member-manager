import type { ReactElement } from "react";
import { TumaiDayEventForm } from "./components/TumaiDayEventForm";
import { TumaiDayEventList } from "./components/TumaiDayEventList";
import { TumaiDayResponsesPanel } from "./components/TumaiDayResponsesPanel";
import { useTumaiDays } from "./hooks/useTumaiDays";
import { ToolPageShell } from "./ToolPageShell";

export default function TumaiDaysPage(): ReactElement {
	const {
		agenda,
		setAgenda,
		scheduledAt,
		setScheduledAt,
		editingEventId,
		selectedEventId,
		setSelectedEventId,
		searchTerm,
		setSearchTerm,
		statusFilter,
		setStatusFilter,
		events,
		isLoadingEvents,
		eventsError,
		selectedEvent,
		responsesData,
		isLoadingResponses,
		filteredResponses,
		responseRate,
		createEventMutation,
		updateEventMutation,
		sendPendingMutation,
		handleSubmit,
		handleStartEdit,
		handleCancelEdit,
		handleDelete,
	} = useTumaiDays();

	return (
		<ToolPageShell
			title="TUM.ai Days RSVP"
			description="Schedule quarterly community gatherings, send Slack DMs, and audit responses."
		>
			<div className="grid grid-cols-1 gap-5 md:grid-cols-12">
				{/* Scheduling Form & Events List */}
				<div className="md:col-span-5">
					<div className="flex flex-col gap-5 md:sticky md:top-4 md:self-start">
						<TumaiDayEventForm
							agenda={agenda}
							onAgendaChange={setAgenda}
							scheduledAt={scheduledAt}
							onScheduledAtChange={setScheduledAt}
							isEditing={!!editingEventId}
							isCreating={createEventMutation.isPending}
							isUpdating={updateEventMutation.isPending}
							onSubmit={handleSubmit}
							onCancelEdit={handleCancelEdit}
						/>

						<TumaiDayEventList
							events={events}
							isLoading={isLoadingEvents}
							hasError={!!eventsError}
							selectedEventId={selectedEventId}
							isSendPending={sendPendingMutation.isPending}
							onSelectEvent={setSelectedEventId}
							onSendPending={() => sendPendingMutation.mutate()}
							onStartEdit={handleStartEdit}
							onDelete={handleDelete}
						/>
					</div>
				</div>

				{/* Audit RSVP Responses View */}
				<div className="md:col-span-7">
					<TumaiDayResponsesPanel
						selectedEventId={selectedEventId}
						isLoading={isLoadingResponses}
						responsesData={responsesData}
						selectedEvent={selectedEvent}
						responseRate={responseRate}
						filteredResponses={filteredResponses}
						searchTerm={searchTerm}
						onSearchTermChange={setSearchTerm}
						statusFilter={statusFilter}
						onStatusFilterChange={setStatusFilter}
					/>
				</div>
			</div>
		</ToolPageShell>
	);
}
