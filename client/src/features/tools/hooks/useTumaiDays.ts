import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../../../contexts/ToastContext";
import { apiClient } from "../../../lib/apiClient";
import type {
	EventResponsesPayload,
	ResponseStatusFilter,
	TumaiDayEvent,
} from "../tumaiDaysTypes";
import {
	computeResponseRate,
	filterResponses,
	toLocalDateTimeInput,
} from "../tumaiDaysUtils";

export function useTumaiDays() {
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [agenda, setAgenda] = useState("");
	const [scheduledAt, setScheduledAt] = useState("");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [editingEventId, setEditingEventId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<ResponseStatusFilter>("all");

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
		// Format the ISO scheduled_at into local YYYY-MM-DDTHH:MM for the input
		setScheduledAt(toLocalDateTimeInput(event.scheduled_at));
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

	const events = eventsData?.events ?? [];
	const selectedEvent = events.find((e) => e.id === selectedEventId);

	const filteredResponses = filterResponses(
		responsesData?.responses ?? [],
		searchTerm,
		statusFilter,
	);

	const responseRate = computeResponseRate(responsesData?.stats);

	return {
		// form state
		agenda,
		setAgenda,
		scheduledAt,
		setScheduledAt,
		editingEventId,
		// selection / filters
		selectedEventId,
		setSelectedEventId,
		searchTerm,
		setSearchTerm,
		statusFilter,
		setStatusFilter,
		// data
		events,
		isLoadingEvents,
		eventsError,
		selectedEvent,
		responsesData,
		isLoadingResponses,
		filteredResponses,
		responseRate,
		// mutations
		createEventMutation,
		updateEventMutation,
		sendPendingMutation,
		// handlers
		handleSubmit,
		handleStartEdit,
		handleCancelEdit,
		handleDelete,
	};
}
