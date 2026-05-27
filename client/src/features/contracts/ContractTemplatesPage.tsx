import DeleteIcon from "@mui/icons-material/Delete";
import {
	Alert,
	Box,
	Button,
	Checkbox,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControlLabel,
	IconButton,
	List,
	ListItemButton,
	ListItemText,
	MenuItem,
	Paper,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import ToolPageShell from "../tools/ToolPageShell";
import {
	type ContractConditionType,
	type ContractTemplate,
	type ContractVariableDataType,
	useContractTemplate,
	useContractTemplates,
	useCreateBlock,
	useCreateContractTemplate,
	useCreateVariable,
	useDeleteBlock,
	useDeleteContractTemplate,
	useDeleteVariable,
	useUpdateContractTemplate,
} from "./useContracts";

const DATA_TYPES: ContractVariableDataType[] = [
	"TEXT",
	"TEXTAREA",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"FILE",
];

const CONDITION_TYPES: ContractConditionType[] = [
	"ALWAYS",
	"IF_YES",
	"IF_NO",
	"IF_VALUE",
];

export default function ContractTemplatesPage(): JSX.Element {
	const templatesQuery = useContractTemplates();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newTemplateOpen, setNewTemplateOpen] = useState(false);

	const createTemplate = useCreateContractTemplate();
	const deleteTemplate = useDeleteContractTemplate();

	useEffect(() => {
		if (!selectedId && templatesQuery.data && templatesQuery.data.length > 0) {
			setSelectedId(templatesQuery.data[0].id);
		}
	}, [selectedId, templatesQuery.data]);

	return (
		<ToolPageShell title="Manage Templates" maxWidth="100%">
		<Box sx={{ display: "flex", gap: 2, minHeight: "70vh" }}>
			<Paper sx={{ width: 320, p: 2 }}>
				<Stack
					direction="row"
					alignItems="center"
					justifyContent="space-between"
					mb={1}
				>
					<Typography variant="h6">Templates</Typography>
					<Button
						size="small"
						variant="contained"
						onClick={() => setNewTemplateOpen(true)}
					>
						+ New
					</Button>
				</Stack>
				{templatesQuery.isLoading ? (
					<Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
						<CircularProgress size={24} />
					</Box>
				) : null}
				{templatesQuery.error ? (
					<Alert severity="error">
						{(templatesQuery.error as Error).message}
					</Alert>
				) : null}
				<List dense>
					{(templatesQuery.data ?? []).map((template) => (
						<TemplateListItem
							key={template.id}
							template={template}
							selected={selectedId === template.id}
							onSelect={() => setSelectedId(template.id)}
							onDelete={() => {
								if (
									window.confirm(
										`Delete template "${template.name}"?`,
									)
								) {
									deleteTemplate.mutate(template.id, {
										onSuccess: () => {
											if (selectedId === template.id) setSelectedId(null);
										},
									});
								}
							}}
						/>
					))}
				</List>
			</Paper>

			<Box sx={{ flex: 1, minWidth: 0 }}>
				{selectedId ? (
					<TemplateEditor templateId={selectedId} />
				) : (
					<Paper sx={{ p: 3 }}>
						<Typography color="text.secondary">
							Select a template or create a new one.
						</Typography>
					</Paper>
				)}
			</Box>

			<NewTemplateDialog
				open={newTemplateOpen}
				onClose={() => setNewTemplateOpen(false)}
				onCreate={(name) =>
					createTemplate.mutate(
						{ name, contract_text: "", is_active: true },
						{
							onSuccess: (template) => {
								setSelectedId(template.id);
								setNewTemplateOpen(false);
							},
						},
					)
				}
				submitting={createTemplate.isPending}
				error={createTemplate.error as Error | null}
			/>
		</Box>
		{deleteTemplate.error ? (
			<Alert severity="error" sx={{ mt: 2 }}>
				{(deleteTemplate.error as Error).message}
			</Alert>
		) : null}
		</ToolPageShell>
	);
}

function TemplateListItem({
	template,
	selected,
	onSelect,
	onDelete,
}: {
	template: ContractTemplate;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}): JSX.Element {
	return (
		<ListItemButton selected={selected} onClick={onSelect}>
			<ListItemText
				primary={template.name}
				secondary={template.is_active ? "active" : "inactive"}
			/>
			<IconButton
				edge="end"
				size="small"
				onClick={(event) => {
					event.stopPropagation();
					onDelete();
				}}
			>
				<DeleteIcon fontSize="small" />
			</IconButton>
		</ListItemButton>
	);
}

function NewTemplateDialog({
	open,
	onClose,
	onCreate,
	submitting,
	error,
}: {
	open: boolean;
	onClose: () => void;
	onCreate: (name: string) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [name, setName] = useState("");
	useEffect(() => {
		if (!open) setName("");
	}, [open]);
	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
			<DialogTitle>New Template</DialogTitle>
			<DialogContent>
				<TextField
					autoFocus
					margin="dense"
					label="Name"
					fullWidth
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				{error ? <Alert severity="error">{error.message}</Alert> : null}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Cancel</Button>
				<Button
					variant="contained"
					disabled={!name.trim() || submitting}
					onClick={() => onCreate(name.trim())}
				>
					Create
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function TemplateEditor({ templateId }: { templateId: string }): JSX.Element {
	const detailQuery = useContractTemplate(templateId);
	const updateTemplate = useUpdateContractTemplate(templateId);
	const createVariable = useCreateVariable(templateId);
	const deleteVariable = useDeleteVariable(templateId);
	const createBlock = useCreateBlock(templateId);
	const deleteBlock = useDeleteBlock(templateId);

	const detail = detailQuery.data;
	const [draft, setDraft] = useState<{
		name: string;
		description: string;
		contract_text: string;
		is_active: boolean;
	} | null>(null);

	useEffect(() => {
		if (detail) {
			setDraft({
				name: detail.template.name,
				description: detail.template.description ?? "",
				contract_text: detail.template.contract_text,
				is_active: detail.template.is_active,
			});
		}
	}, [detail]);

	const dirty = useMemo(() => {
		if (!detail || !draft) return false;
		return (
			detail.template.name !== draft.name ||
			(detail.template.description ?? "") !== draft.description ||
			detail.template.contract_text !== draft.contract_text ||
			detail.template.is_active !== draft.is_active
		);
	}, [detail, draft]);

	if (detailQuery.isLoading || !detail || !draft) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
				<CircularProgress />
			</Box>
		);
	}
	if (detailQuery.error) {
		return (
			<Alert severity="error">{(detailQuery.error as Error).message}</Alert>
		);
	}

	return (
		<Stack spacing={3}>
			<Paper sx={{ p: 3 }}>
				<Stack spacing={2}>
					<TextField
						label="Name"
						value={draft.name}
						onChange={(event) =>
							setDraft({ ...draft, name: event.target.value })
						}
					/>
					<TextField
						label="Description"
						value={draft.description}
						onChange={(event) =>
							setDraft({ ...draft, description: event.target.value })
						}
						multiline
						minRows={2}
					/>
					<TextField
						label={
							'Contract text (use {{variable}} and [IF {{var}} = "x" THEN {...} ELSE {...}])'
						}
						value={draft.contract_text}
						onChange={(event) =>
							setDraft({ ...draft, contract_text: event.target.value })
						}
						multiline
						minRows={14}
						sx={{ fontFamily: "monospace" }}
					/>
					<FormControlLabel
						control={
							<Checkbox
								checked={draft.is_active}
								onChange={(event) =>
									setDraft({ ...draft, is_active: event.target.checked })
								}
							/>
						}
						label="Active (visible to submitters)"
					/>
					<Stack direction="row" spacing={1}>
						<Button
							variant="contained"
							disabled={!dirty || updateTemplate.isPending}
							onClick={() =>
								updateTemplate.mutate({
									name: draft.name,
									description: draft.description || null,
									contract_text: draft.contract_text,
									is_active: draft.is_active,
								})
							}
						>
							Save
						</Button>
						<Button
							disabled={!dirty}
							onClick={() =>
								setDraft({
									name: detail.template.name,
									description: detail.template.description ?? "",
									contract_text: detail.template.contract_text,
									is_active: detail.template.is_active,
								})
							}
						>
							Discard
						</Button>
					</Stack>
					{updateTemplate.error ? (
						<Alert severity="error">
							{(updateTemplate.error as Error).message}
						</Alert>
					) : null}
				</Stack>
			</Paper>

			<Paper sx={{ p: 3 }}>
				<Typography variant="h6" gutterBottom>
					Variables
				</Typography>
				<Divider sx={{ mb: 2 }} />
				<Stack spacing={1}>
					{detail.variables.map((variable) => (
						<Stack
							key={variable.id}
							direction="row"
							alignItems="center"
							spacing={1}
						>
							<Typography sx={{ flex: 1 }}>
								<code>{`{{${variable.variable_name}}}`}</code> —{" "}
								{variable.label}{" "}
								<Typography
									component="span"
									color="text.secondary"
									variant="caption"
								>
									({variable.data_type}
									{variable.is_required ? ", required" : ""})
								</Typography>
							</Typography>
							<IconButton
								size="small"
								onClick={() =>
									window.confirm("Delete variable?") &&
									deleteVariable.mutate(variable.id)
								}
							>
								<DeleteIcon fontSize="small" />
							</IconButton>
						</Stack>
					))}
				</Stack>
				<Divider sx={{ my: 2 }} />
				<NewVariableForm
					onSubmit={(values) => createVariable.mutate(values)}
					submitting={createVariable.isPending}
					error={createVariable.error as Error | null}
				/>
			</Paper>

			<Paper sx={{ p: 3 }}>
				<Typography variant="h6" gutterBottom>
					Conditional Blocks
				</Typography>
				<Divider sx={{ mb: 2 }} />
				<Stack spacing={1}>
					{detail.blocks.map((block) => (
						<Stack
							key={block.id}
							direction="row"
							alignItems="flex-start"
							spacing={1}
						>
							<Box sx={{ flex: 1 }}>
								<Typography variant="subtitle2">{block.name}</Typography>
								<Typography variant="caption" color="text.secondary">
									{block.condition_type}
									{block.condition_variable
										? ` · ${block.condition_variable}`
										: ""}
									{block.condition_value ? ` = ${block.condition_value}` : ""}
								</Typography>
								<Typography
									variant="body2"
									sx={{
										whiteSpace: "pre-wrap",
										mt: 0.5,
										fontFamily: "monospace",
									}}
								>
									{block.block_text}
								</Typography>
							</Box>
							<IconButton
								size="small"
								onClick={() =>
									window.confirm("Delete block?") &&
									deleteBlock.mutate(block.id)
								}
							>
								<DeleteIcon fontSize="small" />
							</IconButton>
						</Stack>
					))}
				</Stack>
				<Divider sx={{ my: 2 }} />
				<NewBlockForm
					onSubmit={(values) => createBlock.mutate(values)}
					submitting={createBlock.isPending}
					error={createBlock.error as Error | null}
				/>
			</Paper>
		</Stack>
	);
}

function NewVariableForm({
	onSubmit,
	submitting,
	error,
}: {
	onSubmit: (values: {
		variable_name: string;
		label: string;
		data_type: ContractVariableDataType;
		help_text: string | null;
		options: string[] | null;
		is_required: boolean;
		is_multiselect: boolean;
		show_if_variable: string | null;
		show_if_value: string | null;
		sort_order: number;
	}) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [variableName, setVariableName] = useState("");
	const [label, setLabel] = useState("");
	const [dataType, setDataType] = useState<ContractVariableDataType>("TEXT");
	const [helpText, setHelpText] = useState("");
	const [optionsRaw, setOptionsRaw] = useState("");
	const [required, setRequired] = useState(false);

	return (
		<Stack spacing={1.5}>
			<Typography variant="subtitle2">New Variable</Typography>
			<Stack direction="row" spacing={1}>
				<TextField
					label="variable_name"
					value={variableName}
					onChange={(event) => setVariableName(event.target.value)}
					size="small"
				/>
				<TextField
					label="Label"
					value={label}
					onChange={(event) => setLabel(event.target.value)}
					size="small"
					sx={{ flex: 1 }}
				/>
				<TextField
					select
					label="Type"
					value={dataType}
					onChange={(event) =>
						setDataType(event.target.value as ContractVariableDataType)
					}
					size="small"
					sx={{ minWidth: 120 }}
				>
					{DATA_TYPES.map((type) => (
						<MenuItem key={type} value={type}>
							{type}
						</MenuItem>
					))}
				</TextField>
			</Stack>
			<TextField
				label="Help text (optional)"
				value={helpText}
				onChange={(event) => setHelpText(event.target.value)}
				size="small"
			/>
			{dataType === "SELECT" ? (
				<TextField
					label="Options (comma-separated)"
					value={optionsRaw}
					onChange={(event) => setOptionsRaw(event.target.value)}
					size="small"
				/>
			) : null}
			<FormControlLabel
				control={
					<Checkbox
						checked={required}
						onChange={(event) => setRequired(event.target.checked)}
					/>
				}
				label="Required field"
			/>
			{error ? <Alert severity="error">{error.message}</Alert> : null}
			<Box>
				<Button
					variant="contained"
					size="small"
					disabled={!variableName.trim() || !label.trim() || submitting}
					onClick={() => {
						const options =
							dataType === "SELECT" && optionsRaw.trim()
								? optionsRaw
										.split(",")
										.map((entry) => entry.trim())
										.filter(Boolean)
								: null;
						onSubmit({
							variable_name: variableName.trim(),
							label: label.trim(),
							data_type: dataType,
							help_text: helpText.trim() || null,
							options,
							is_required: required,
							is_multiselect: false,
							show_if_variable: null,
							show_if_value: null,
							sort_order: 0,
						});
						setVariableName("");
						setLabel("");
						setDataType("TEXT");
						setHelpText("");
						setOptionsRaw("");
						setRequired(false);
					}}
				>
					Add Variable
				</Button>
			</Box>
		</Stack>
	);
}

function NewBlockForm({
	onSubmit,
	submitting,
	error,
}: {
	onSubmit: (values: {
		name: string;
		condition_type: ContractConditionType;
		condition_variable: string | null;
		condition_value: string | null;
		block_text: string;
		sort_order: number;
	}) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [name, setName] = useState("");
	const [conditionType, setConditionType] =
		useState<ContractConditionType>("ALWAYS");
	const [conditionVariable, setConditionVariable] = useState("");
	const [conditionValue, setConditionValue] = useState("");
	const [blockText, setBlockText] = useState("");

	const needsVariable = conditionType !== "ALWAYS";
	const needsValue = conditionType === "IF_VALUE";

	return (
		<Stack spacing={1.5}>
			<Typography variant="subtitle2">New Block</Typography>
			<Stack direction="row" spacing={1}>
				<TextField
					label="Name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					size="small"
					sx={{ flex: 1 }}
				/>
				<TextField
					select
					label="Condition"
					value={conditionType}
					onChange={(event) =>
						setConditionType(event.target.value as ContractConditionType)
					}
					size="small"
					sx={{ minWidth: 130 }}
				>
					{CONDITION_TYPES.map((type) => (
						<MenuItem key={type} value={type}>
							{type}
						</MenuItem>
					))}
				</TextField>
				{needsVariable ? (
					<TextField
						label="Variable"
						value={conditionVariable}
						onChange={(event) => setConditionVariable(event.target.value)}
						size="small"
					/>
				) : null}
				{needsValue ? (
					<TextField
						label="Value"
						value={conditionValue}
						onChange={(event) => setConditionValue(event.target.value)}
						size="small"
					/>
				) : null}
			</Stack>
			<TextField
				label="Block Text"
				value={blockText}
				onChange={(event) => setBlockText(event.target.value)}
				multiline
				minRows={3}
				sx={{ fontFamily: "monospace" }}
			/>
			{error ? <Alert severity="error">{error.message}</Alert> : null}
			<Box>
				<Button
					variant="contained"
					size="small"
					disabled={
						!name.trim() ||
						(needsVariable && !conditionVariable.trim()) ||
						submitting
					}
					onClick={() => {
						onSubmit({
							name: name.trim(),
							condition_type: conditionType,
							condition_variable: needsVariable
								? conditionVariable.trim()
								: null,
							condition_value: needsValue ? conditionValue.trim() : null,
							block_text: blockText,
							sort_order: 0,
						});
						setName("");
						setConditionType("ALWAYS");
						setConditionVariable("");
						setConditionValue("");
						setBlockText("");
					}}
				>
					Add Block
				</Button>
			</Box>
		</Stack>
	);
}
