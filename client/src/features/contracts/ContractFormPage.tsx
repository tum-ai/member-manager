import {
	Alert,
	Box,
	Button,
	CircularProgress,
	MenuItem,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIsAdmin } from "../../hooks/useIsAdmin";
import { supabase } from "../../lib/supabaseClient";
import ToolPageShell from "../tools/ToolPageShell";
import ContractDocumentPreview from "./ContractDocumentPreview";
import DynamicForm, { isVisible } from "./DynamicForm";
import {
	useContractPreview,
	useContractSubmission,
	useContractTemplate,
	useContractTemplates,
	useCreateContractSubmission,
	useUpdateContractDraft,
} from "./useContracts";

export default function ContractFormPage(): JSX.Element {
	const navigate = useNavigate();
	const { draftId } = useParams<{ draftId: string }>();
	const isEditingDraft = Boolean(draftId);
	const templatesQuery = useContractTemplates();
	const draftQuery = useContractSubmission(draftId);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const initializedDraftId = useRef<string | null>(null);
	const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(
		currentUserId ?? undefined,
	);
	const activeTemplates = useMemo(
		() => (templatesQuery.data ?? []).filter((template) => template.is_active),
		[templatesQuery.data],
	);
	const selectableTemplates = isEditingDraft
		? (templatesQuery.data ?? [])
		: activeTemplates;

	const [selectedId, setSelectedId] = useState<string>("");
	useEffect(() => {
		if (!isEditingDraft && !selectedId && activeTemplates.length > 0) {
			setSelectedId(activeTemplates[0].id);
		}
	}, [activeTemplates, isEditingDraft, selectedId]);

	useEffect(() => {
		const draft = draftQuery.data;
		if (!draft || !isEditingDraft) return;
		if (initializedDraftId.current === draft.id) return;
		initializedDraftId.current = draft.id;
		setSelectedId(draft.template_id);
		setFormData(draft.form_data ?? {});
	}, [draftQuery.data, isEditingDraft]);

	useEffect(() => {
		let cancelled = false;
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (!cancelled) setCurrentUserId(session?.user.id ?? null);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const detailQuery = useContractTemplate(selectedId || undefined);
	const [formData, setFormData] = useState<Record<string, unknown>>({});
	const previewQuery = useContractPreview(selectedId || undefined, formData);

	const missingRequired = useMemo(() => {
		if (!detailQuery.data) return [];
		return detailQuery.data.variables
			.filter((v) => {
				if (!isVisible(v, formData)) return false;
				if (!v.is_required) return false;
				const val = formData[v.variable_name];
				return (
					val === undefined ||
					val === null ||
					val === "" ||
					(Array.isArray(val) && val.length === 0)
				);
			})
			.map((v) => v.label);
	}, [detailQuery.data, formData]);

	const createSubmission = useCreateContractSubmission();
	const updateDraft = useUpdateContractDraft(draftId ?? "");
	const saving = createSubmission.isPending || updateDraft.isPending;
	const mutationError = createSubmission.error ?? updateDraft.error;

	function saveDraft(status: "draft" | "submitted"): void {
		if (isEditingDraft && draftId) {
			updateDraft.mutate(
				{ form_data: formData, status },
				{
					onSuccess: (submission) => {
						if (status === "submitted") {
							navigate(`/contracts/submissions/${submission.id}`);
						}
					},
				},
			);
			return;
		}

		createSubmission.mutate(
			{
				template_id: selectedId,
				form_data: formData,
				status,
			},
			{
				onSuccess: (submission) => {
					navigate(
						status === "submitted"
							? `/contracts/submissions/${submission.id}`
							: `/contracts/drafts/${submission.id}`,
					);
				},
			},
		);
	}

	const draftCannotBeEdited =
		isEditingDraft && draftQuery.data && draftQuery.data.status !== "draft";
	const draftPermissionLoading =
		isEditingDraft &&
		draftQuery.data &&
		draftQuery.data.submitter_user_id !== currentUserId &&
		isLoadingAdmin;
	const draftCannotBeEditedByUser =
		isEditingDraft &&
		draftQuery.data &&
		draftQuery.data.submitter_user_id !== currentUserId &&
		!isAdmin &&
		!isLoadingAdmin;

	return (
		<ToolPageShell
			title={isEditingDraft ? "Edit Contract Draft" : "Create Contract"}
			maxWidth="min(1720px, 100%)"
		>
			{templatesQuery.isLoading ||
			(isEditingDraft && draftQuery.isLoading) ||
			draftPermissionLoading ? (
				<CircularProgress />
			) : templatesQuery.error ? (
				<Alert severity="error">
					{(templatesQuery.error as Error).message}
				</Alert>
			) : draftQuery.error ? (
				<Alert severity="error">{(draftQuery.error as Error).message}</Alert>
			) : draftCannotBeEditedByUser ? (
				<Alert severity="warning">
					Only the draft creator can edit this draft.
				</Alert>
			) : draftCannotBeEdited ? (
				<Alert severity="warning">
					This draft has already been submitted and can no longer be edited
					here.
				</Alert>
			) : selectableTemplates.length === 0 ? (
				<Alert severity="info">No active templates are available.</Alert>
			) : (
				<Stack spacing={3}>
					{detailQuery.isLoading ? (
						<CircularProgress />
					) : detailQuery.data ? (
						<Box
							sx={{
								alignItems: "start",
								display: "grid",
								gap: 2,
								gridTemplateColumns: {
									xs: "1fr",
									lg: "minmax(300px, 360px) minmax(0, 1fr)",
								},
							}}
						>
							<Paper
								sx={{
									p: 2,
									position: { lg: "sticky" },
									top: { lg: 24 },
									width: "100%",
								}}
							>
								<TextField
									fullWidth
									select
									label="Template"
									value={selectedId}
									disabled={isEditingDraft}
									onChange={(event) => {
										setSelectedId(event.target.value);
										setFormData({});
									}}
									sx={{ mb: 3 }}
								>
									{selectableTemplates.map((template) => (
										<MenuItem key={template.id} value={template.id}>
											{template.name}
										</MenuItem>
									))}
								</TextField>
								<Typography variant="h6" gutterBottom>
									Form
								</Typography>
								<DynamicForm
									variables={detailQuery.data.variables}
									values={formData}
									onChange={setFormData}
									disabled={saving}
								/>
								<Stack direction="row" spacing={1} sx={{ mt: 3 }}>
									<Button
										variant="contained"
										disabled={saving || missingRequired.length > 0}
										onClick={() => saveDraft("submitted")}
									>
										{isEditingDraft ? "Submit Draft" : "Submit"}
									</Button>
									<Button disabled={saving} onClick={() => saveDraft("draft")}>
										{isEditingDraft ? "Save Draft" : "Save as Draft"}
									</Button>
								</Stack>
								{missingRequired.length > 0 ? (
									<Alert severity="warning" sx={{ mt: 2 }}>
										Required fields missing: {missingRequired.join(", ")}
									</Alert>
								) : null}
								{mutationError ? (
									<Alert severity="error" sx={{ mt: 2 }}>
										{(mutationError as Error).message}
									</Alert>
								) : null}
							</Paper>
							<Paper sx={{ p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
								<Typography variant="h6" gutterBottom>
									Preview
								</Typography>
								{previewQuery.error ? (
									<Alert severity="error" sx={{ mb: 2 }}>
										{(previewQuery.error as Error).message}
									</Alert>
								) : null}
								<ContractDocumentPreview
									pages={previewQuery.data?.pages}
									loading={previewQuery.isLoading || previewQuery.isFetching}
									maxHeight={{
										xs: "72vh",
										lg: "calc(100vh - 170px)",
									}}
									minHeight={{ xs: 520, lg: "calc(100vh - 170px)" }}
								/>
							</Paper>
						</Box>
					) : null}
				</Stack>
			)}
		</ToolPageShell>
	);
}
