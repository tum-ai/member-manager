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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToolPageShell from "../tools/ToolPageShell";
import ContractDocumentPreview from "./ContractDocumentPreview";
import DynamicForm, { isVisible } from "./DynamicForm";
import {
	useContractPreview,
	useContractTemplate,
	useContractTemplates,
	useCreateContractSubmission,
} from "./useContracts";

export default function ContractFormPage(): JSX.Element {
	const navigate = useNavigate();
	const templatesQuery = useContractTemplates();
	const activeTemplates = useMemo(
		() => (templatesQuery.data ?? []).filter((template) => template.is_active),
		[templatesQuery.data],
	);

	const [selectedId, setSelectedId] = useState<string>("");
	useEffect(() => {
		if (!selectedId && activeTemplates.length > 0) {
			setSelectedId(activeTemplates[0].id);
		}
	}, [activeTemplates, selectedId]);

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

	return (
		<ToolPageShell title="Create Contract" maxWidth="min(1720px, 100%)">
			{templatesQuery.isLoading ? (
				<CircularProgress />
			) : templatesQuery.error ? (
				<Alert severity="error">
					{(templatesQuery.error as Error).message}
				</Alert>
			) : activeTemplates.length === 0 ? (
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
									onChange={(event) => {
										setSelectedId(event.target.value);
										setFormData({});
									}}
									sx={{ mb: 3 }}
								>
									{activeTemplates.map((template) => (
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
								/>
								<Stack direction="row" spacing={1} sx={{ mt: 3 }}>
									<Button
										variant="contained"
										disabled={
											createSubmission.isPending || missingRequired.length > 0
										}
										onClick={() =>
											createSubmission.mutate(
												{
													template_id: selectedId,
													form_data: formData,
													status: "submitted",
												},
												{
													onSuccess: (submission) =>
														navigate(`/contracts/submissions/${submission.id}`),
												},
											)
										}
									>
										Submit
									</Button>
									<Button
										disabled={createSubmission.isPending}
										onClick={() =>
											createSubmission.mutate({
												template_id: selectedId,
												form_data: formData,
												status: "draft",
											})
										}
									>
										Save as Draft
									</Button>
								</Stack>
								{missingRequired.length > 0 ? (
									<Alert severity="warning" sx={{ mt: 2 }}>
										Required fields missing: {missingRequired.join(", ")}
									</Alert>
								) : null}
								{createSubmission.error ? (
									<Alert severity="error" sx={{ mt: 2 }}>
										{(createSubmission.error as Error).message}
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
									pageMaxWidth={{ xs: "100%", lg: 1040, xl: 1120 }}
								/>
							</Paper>
						</Box>
					) : null}
				</Stack>
			)}
		</ToolPageShell>
	);
}
