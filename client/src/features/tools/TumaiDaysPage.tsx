import {
	CalendarMonth as CalendarIcon,
	DeleteOutline as DeleteIcon,
	EditOutlined as EditIcon,
	EventAvailable as EventAvailableIcon,
	Send as SendIcon,
} from "@mui/icons-material";
import {
	Alert,
	Box,
	Button,
	CardContent,
	Chip,
	CircularProgress,
	Divider,
	FormControl,
	Grid,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
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
	const theme = useTheme();
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

	return (
		<ToolPageShell
			title="TUM.ai Days RSVP"
			description="Schedule quarterly community gatherings, send Slack DMs, and audit responses."
		>
			<Grid container spacing={4}>
				{/* Scheduling Form & Events List */}
				<Grid size={{ xs: 12, md: 5 }}>
					<Stack spacing={4}>
						{/* Form Card */}
						<GlassCard>
							<CardContent sx={{ p: 4 }}>
								<Typography variant="h4" sx={{ mb: 3, fontWeight: "bold" }}>
									{editingEventId ? "Edit Event" : "Schedule Event"}
								</Typography>
								<Box
									component="form"
									onSubmit={handleSubmit}
									sx={{ display: "grid", gap: 3 }}
								>
									<TextField
										label="Event Agenda"
										multiline
										rows={6}
										value={agenda}
										onChange={(e) => setAgenda(e.target.value)}
										placeholder="Introduce the TUM.ai Day agenda, location, and important notes..."
										variant="outlined"
										fullWidth
										required
										sx={{
											"& .MuiOutlinedInput-root": {
												borderRadius: 3,
											},
										}}
									/>
									<TextField
										label="Schedule Slack Send Time"
										type="datetime-local"
										value={scheduledAt}
										onChange={(e) => setScheduledAt(e.target.value)}
										InputLabelProps={{ shrink: true }}
										variant="outlined"
										fullWidth
										required
										sx={{
											"& .MuiOutlinedInput-root": {
												borderRadius: 3,
											},
										}}
									/>
									<Stack direction="row" spacing={2}>
										<Button
											type="submit"
											variant="contained"
											color="primary"
											size="large"
											disabled={
												createEventMutation.isPending ||
												updateEventMutation.isPending
											}
											startIcon={<CalendarIcon />}
											sx={{
												flexGrow: 1,
												bgcolor: "#9A64D9",
												"&:hover": { bgcolor: "#523573" },
												py: 2,
												fontSize: "1.1rem",
												fontWeight: "bold",
												borderRadius: 3,
											}}
										>
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
												variant="outlined"
												color="secondary"
												size="large"
												onClick={handleCancelEdit}
												sx={{
													py: 2,
													fontSize: "1.1rem",
													borderRadius: 3,
												}}
											>
												Cancel
											</Button>
										)}
									</Stack>
								</Box>
							</CardContent>
						</GlassCard>

						{/* Events List Card */}
						<GlassCard>
							<CardContent sx={{ p: 3 }}>
								<Stack
									direction="row"
									justifyContent="space-between"
									alignItems="center"
									sx={{ mb: 2 }}
								>
									<Typography variant="h5" sx={{ fontWeight: "bold" }}>
										Scheduled Events
									</Typography>
									<Button
										size="small"
										variant="outlined"
										color="primary"
										onClick={() => sendPendingMutation.mutate()}
										disabled={sendPendingMutation.isPending}
										startIcon={<SendIcon />}
										sx={{
											color: "#9A64D9",
											borderColor: alpha("#9A64D9", 0.5),
											"&:hover": {
												borderColor: "#9A64D9",
												bgcolor: alpha("#9A64D9", 0.08),
											},
										}}
									>
										Check Scheduler
									</Button>
								</Stack>

								{isLoadingEvents ? (
									<Box
										sx={{ display: "flex", justifyContent: "center", py: 4 }}
									>
										<CircularProgress />
									</Box>
								) : eventsError ? (
									<Alert severity="error">Failed to load events.</Alert>
								) : events.length === 0 ? (
									<Typography
										color="text.secondary"
										align="center"
										sx={{ py: 3 }}
									>
										No scheduled events. Create one above!
									</Typography>
								) : (
									<Stack spacing={1.5}>
										{events.map((event) => {
											const isSelected = event.id === selectedEventId;
											const isSent = !!event.sent_at;
											const isPast = new Date(event.scheduled_at) <= new Date();

											return (
												<Paper
													key={event.id}
													onClick={() => setSelectedEventId(event.id)}
													sx={{
														p: 2.5,
														cursor: "pointer",
														borderRadius: 3,
														border: "1px solid",
														borderColor: isSelected
															? "#9A64D9"
															: theme.palette.mode === "light"
																? "#EFEFEF"
																: alpha("#FFFFFF", 0.08),
														bgcolor: isSelected
															? alpha(
																	"#9A64D9",
																	theme.palette.mode === "light" ? 0.05 : 0.1,
																)
															: "transparent",
														transition: "all 0.2s ease-in-out",
														"&:hover": {
															borderColor: isSelected
																? "#9A64D9"
																: alpha("#9A64D9", 0.5),
															bgcolor: isSelected
																? alpha(
																		"#9A64D9",
																		theme.palette.mode === "light"
																			? 0.08
																			: 0.15,
																	)
																: alpha("#9A64D9", 0.03),
														},
													}}
												>
													<Stack
														direction="row"
														justifyContent="space-between"
														alignItems="flex-start"
														spacing={2}
													>
														<Box sx={{ minWidth: 0, flex: 1 }}>
															<Typography
																variant="subtitle1"
																sx={{
																	fontWeight: "bold",
																	lineHeight: 1.3,
																	mb: 0.5,
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																}}
															>
																{event.agenda}
															</Typography>
															<Typography
																variant="caption"
																color="text.secondary"
																display="block"
															>
																Send time: {formatDate(event.scheduled_at)}
															</Typography>
															<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
																{isSent ? (
																	<Chip
																		size="small"
																		label={`Sent ${formatDate(event.sent_at!)}`}
																		color="success"
																		variant="outlined"
																		sx={{ fontSize: "0.65rem", height: 18 }}
																	/>
																) : isPast ? (
																	<Chip
																		size="small"
																		label="Pending Send"
																		color="warning"
																		sx={{ fontSize: "0.65rem", height: 18 }}
																	/>
																) : (
																	<Chip
																		size="small"
																		label="Scheduled"
																		color="primary"
																		variant="outlined"
																		sx={{
																			fontSize: "0.65rem",
																			height: 18,
																			color: "#9A64D9",
																			borderColor: "#9A64D9",
																		}}
																	/>
																)}
															</Stack>
														</Box>
														<Stack
															direction="row"
															spacing={0.5}
															alignItems="center"
														>
															<Tooltip title="Edit Event">
																<IconButton
																	size="small"
																	color="primary"
																	onClick={(e) => handleStartEdit(event, e)}
																	sx={{ color: "#9A64D9" }}
																>
																	<EditIcon fontSize="small" />
																</IconButton>
															</Tooltip>
															<Tooltip title="Delete Event">
																<IconButton
																	size="small"
																	color="error"
																	onClick={(e) => handleDelete(event.id, e)}
																>
																	<DeleteIcon fontSize="small" />
																</IconButton>
															</Tooltip>
														</Stack>
													</Stack>
												</Paper>
											);
										})}
									</Stack>
								)}
							</CardContent>
						</GlassCard>
					</Stack>
				</Grid>

				{/* Audit RSVP Responses View */}
				<Grid size={{ xs: 12, md: 7 }}>
					<GlassCard sx={{ height: "100%" }}>
						<CardContent sx={{ p: 3 }}>
							{!selectedEventId ? (
								<Box
									sx={{
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										justifyContent: "center",
										minHeight: 400,
										color: "text.secondary",
									}}
								>
									<EventAvailableIcon
										sx={{
											fontSize: 60,
											mb: 2,
											color: alpha(theme.palette.text.secondary, 0.2),
										}}
									/>
									<Typography variant="h6">No Event Selected</Typography>
									<Typography variant="body2" sx={{ mt: 1 }}>
										Select an event from the list to view attendee numbers and
										RSVP auditing logs.
									</Typography>
								</Box>
							) : isLoadingResponses ? (
								<Box
									sx={{
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										minHeight: 400,
									}}
								>
									<CircularProgress />
								</Box>
							) : !responsesData ? (
								<Alert severity="error">Failed to load RSVP details.</Alert>
							) : (
								<Box>
									{/* Event Header Summary */}
									<Box sx={{ mb: 3 }}>
										<Typography variant="h5" sx={{ fontWeight: "bold", mb: 1 }}>
											Audit Log
										</Typography>
										<Typography
											variant="body2"
											color="text.secondary"
											sx={{ whiteSpace: "pre-wrap" }}
										>
											<strong>Agenda:</strong> {selectedEvent?.agenda}
										</Typography>
									</Box>

									<Divider sx={{ my: 2 }} />

									{/* Stats Row */}
									<Grid container spacing={2} sx={{ mb: 3 }}>
										<Grid item xs={6} sm={3}>
											<Paper
												sx={{
													p: 2,
													textAlign: "center",
													borderRadius: 3,
													bgcolor: alpha(theme.palette.primary.main, 0.04),
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Total Active
												</Typography>
												<Typography variant="h5" sx={{ fontWeight: "bold" }}>
													{responsesData.stats.total}
												</Typography>
											</Paper>
										</Grid>
										<Grid item xs={6} sm={3}>
											<Paper
												sx={{
													p: 2,
													textAlign: "center",
													borderRadius: 3,
													bgcolor: alpha(theme.palette.success.main, 0.04),
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Attending (Yes)
												</Typography>
												<Typography
													variant="h5"
													color="success.main"
													sx={{ fontWeight: "bold" }}
												>
													{responsesData.stats.yes}
												</Typography>
											</Paper>
										</Grid>
										<Grid item xs={6} sm={3}>
											<Paper
												sx={{
													p: 2,
													textAlign: "center",
													borderRadius: 3,
													bgcolor: alpha(theme.palette.error.main, 0.04),
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Declined (No)
												</Typography>
												<Typography
													variant="h5"
													color="error.main"
													sx={{ fontWeight: "bold" }}
												>
													{responsesData.stats.no}
												</Typography>
											</Paper>
										</Grid>
										<Grid item xs={6} sm={3}>
											<Paper
												sx={{
													p: 2,
													textAlign: "center",
													borderRadius: 3,
													bgcolor: alpha(theme.palette.warning.main, 0.04),
												}}
											>
												<Typography variant="caption" color="text.secondary">
													No Response
												</Typography>
												<Typography
													variant="h5"
													color="warning.main"
													sx={{ fontWeight: "bold" }}
												>
													{responsesData.stats.pending}
												</Typography>
											</Paper>
										</Grid>
									</Grid>

									{/* Filters and Search */}
									<Stack
										direction={{ xs: "column", sm: "row" }}
										spacing={2}
										sx={{ mb: 3 }}
									>
										<TextField
											size="small"
											label="Search by Name or Email"
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											fullWidth
										/>
										<FormControl size="small" sx={{ minWidth: 160 }}>
											<InputLabel>Response Status</InputLabel>
											<Select
												value={statusFilter}
												label="Response Status"
												onChange={(e) => setStatusFilter(e.target.value as any)}
											>
												<MenuItem value="all">All responses</MenuItem>
												<MenuItem value="yes">Attending (Yes)</MenuItem>
												<MenuItem value="no">Declined (No)</MenuItem>
												<MenuItem value="pending">Pending</MenuItem>
											</Select>
										</FormControl>
									</Stack>

									{/* Responses Table */}
									<TableContainer
										component={Paper}
										sx={{
											borderRadius: 3,
											boxShadow: "none",
											border: "1px solid",
											borderColor:
												theme.palette.mode === "light"
													? "#EFEFEF"
													: alpha("#FFFFFF", 0.08),
										}}
									>
										<Table>
											<TableHead>
												<TableRow>
													<TableCell sx={{ fontWeight: "bold" }}>
														Member
													</TableCell>
													<TableCell sx={{ fontWeight: "bold" }}>
														Department
													</TableCell>
													<TableCell sx={{ fontWeight: "bold" }}>
														Status
													</TableCell>
													<TableCell sx={{ fontWeight: "bold" }}>
														Reason for Absence
													</TableCell>
												</TableRow>
											</TableHead>
											<TableBody>
												{filteredResponses.length === 0 ? (
													<TableRow>
														<TableCell
															colSpan={4}
															align="center"
															sx={{ py: 3 }}
														>
															No matches found.
														</TableCell>
													</TableRow>
												) : (
													filteredResponses.map((row) => (
														<TableRow key={row.userId}>
															<TableCell>
																<Typography
																	variant="body2"
																	sx={{ fontWeight: "bold" }}
																>
																	{row.givenName} {row.surname}
																</Typography>
																<Typography
																	variant="caption"
																	color="text.secondary"
																>
																	{row.email}
																</Typography>
															</TableCell>
															<TableCell>{row.department}</TableCell>
															<TableCell>
																{row.status === "yes" ? (
																	<Chip
																		label="Yes"
																		color="success"
																		size="small"
																	/>
																) : row.status === "no" ? (
																	<Chip label="No" color="error" size="small" />
																) : (
																	<Chip
																		label="Pending"
																		color="warning"
																		size="small"
																		variant="outlined"
																	/>
																)}
															</TableCell>
															<TableCell>
																<Typography
																	variant="body2"
																	sx={{
																		fontStyle: row.reason ? "normal" : "italic",
																		color: row.reason
																			? "text.primary"
																			: "text.secondary",
																	}}
																>
																	{row.reason ||
																		(row.status === "no"
																			? "No reason given"
																			: "—")}
																</Typography>
															</TableCell>
														</TableRow>
													))
												)}
											</TableBody>
										</Table>
									</TableContainer>
								</Box>
							)}
						</CardContent>
					</GlassCard>
				</Grid>
			</Grid>
		</ToolPageShell>
	);
}
