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
import DynamicForm, { isVisible } from "./DynamicForm";
import { renderContractText } from "./renderContract";
import {
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

	const preview = useMemo(() => {
		if (!detailQuery.data) return "";
		return renderContractText(
			detailQuery.data.template.contract_text,
			formData,
			detailQuery.data.blocks,
		);
	}, [detailQuery.data, formData]);

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
		<ToolPageShell title="Create Contract">
			{templatesQuery.isLoading ? (
				<CircularProgress />
			) : activeTemplates.length === 0 ? (
				<Alert severity="info">No active templates are available.</Alert>
			) : (
				<Stack spacing={3}>
					<Paper sx={{ p: 2 }}>
						<TextField
							select
							label="Template"
							value={selectedId}
							onChange={(event) => {
								setSelectedId(event.target.value);
								setFormData({});
							}}
							sx={{ minWidth: 280 }}
						>
							{activeTemplates.map((template) => (
								<MenuItem key={template.id} value={template.id}>
									{template.name}
								</MenuItem>
							))}
						</TextField>
					</Paper>

					{detailQuery.isLoading ? (
						<CircularProgress />
					) : detailQuery.data ? (
						<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
							<Paper sx={{ p: 3, flex: 1, minWidth: 320 }}>
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
							<Paper sx={{ p: 3, flex: 1, minWidth: 320 }}>
								<Typography variant="h6" gutterBottom>
									Preview
								</Typography>
								<Typography
									sx={{
										whiteSpace: "pre-wrap",
										fontFamily: "monospace",
										fontSize: 13,
									}}
								>
									{preview || "(empty)"}
								</Typography>
							</Paper>
						</Box>
					) : null}
				</Stack>
			)}
		</ToolPageShell>
	);
}
