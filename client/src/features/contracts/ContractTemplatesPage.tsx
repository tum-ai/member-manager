import { PanelRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { Textarea } from "@/components/ui/textarea";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import { cn } from "@/lib/utils";
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
	"EMAIL",
	"TEXTAREA",
	"NUMBER",
	"DATE",
	"BOOLEAN",
	"SELECT",
	"FILE",
];

const DATA_TYPE_LABELS: Record<ContractVariableDataType, string> = {
	TEXT: "Text",
	EMAIL: "Email",
	TEXTAREA: "Long text",
	NUMBER: "Number",
	DATE: "Date",
	BOOLEAN: "Yes / No",
	SELECT: "Dropdown",
	FILE: "File",
};

const CONDITION_TYPES: ContractConditionType[] = [
	"ALWAYS",
	"IF_YES",
	"IF_NO",
	"IF_VALUE",
];

const CONDITION_TYPE_LABELS: Record<ContractConditionType, string> = {
	ALWAYS: "Always",
	IF_YES: "If yes",
	IF_NO: "If no",
	IF_VALUE: "If value equals",
};

export default function ContractTemplatesPage(): JSX.Element {
	const templatesQuery = useContractTemplates();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [newTemplateOpen, setNewTemplateOpen] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(
		null,
	);

	const createTemplate = useCreateContractTemplate();
	const deleteTemplate = useDeleteContractTemplate();

	useEffect(() => {
		if (!selectedId && templatesQuery.data && templatesQuery.data.length > 0) {
			setSelectedId(templatesQuery.data[0].id);
		}
	}, [selectedId, templatesQuery.data]);

	const templates = templatesQuery.data ?? [];
	const selectedTemplate = templates.find((item) => item.id === selectedId);

	return (
		<ToolPageShell title="Manage Templates">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<Sheet open={listOpen} onOpenChange={setListOpen}>
						<SheetTrigger asChild>
							<Button variant="outline">
								<PanelRight className="size-4" />
								Browse templates
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-full sm:max-w-sm">
							<SheetHeader>
								<SheetTitle>Templates</SheetTitle>
							</SheetHeader>
							<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
								{templatesQuery.isLoading ? <TemplateListSkeleton /> : null}
								{templatesQuery.error ? (
									<Alert variant="destructive">
										<AlertDescription>
											{(templatesQuery.error as Error).message}
										</AlertDescription>
									</Alert>
								) : null}
								<div className="flex flex-col gap-0.5">
									{templates.map((template) => (
										<TemplateListItem
											key={template.id}
											template={template}
											selected={selectedId === template.id}
											onSelect={() => {
												setSelectedId(template.id);
												setListOpen(false);
											}}
											onDelete={() => setDeleteTarget(template)}
										/>
									))}
									{!templatesQuery.isLoading && templates.length === 0 ? (
										<p className="p-2 text-sm text-muted-foreground">
											No templates yet.
										</p>
									) : null}
								</div>
							</div>
						</SheetContent>
					</Sheet>
					{selectedTemplate ? (
						<p className="truncate text-sm text-muted-foreground">
							Editing{" "}
							<span className="font-medium text-foreground">
								{selectedTemplate.name}
							</span>
						</p>
					) : null}
				</div>
				<Button onClick={() => setNewTemplateOpen(true)}>
					<Plus className="size-4" />
					New template
				</Button>
			</div>

			<div className="min-w-0">
				{selectedId ? (
					<TemplateEditor templateId={selectedId} />
				) : (
					<GlassCard className="p-10 text-center">
						<p className="text-muted-foreground">
							No template selected. Browse templates to pick one, or create a
							new one.
						</p>
					</GlassCard>
				)}
			</div>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="Delete template?"
				description={
					deleteTarget
						? `"${deleteTarget.name}" and its variables and blocks will be permanently removed.`
						: undefined
				}
				confirmLabel="Delete"
				destructive
				onConfirm={() => {
					if (!deleteTarget) return;
					const targetId = deleteTarget.id;
					deleteTemplate.mutate(targetId, {
						onSuccess: () => {
							if (selectedId === targetId) setSelectedId(null);
						},
					});
				}}
			/>

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
			{deleteTemplate.error ? (
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>
						{(deleteTemplate.error as Error).message}
					</AlertDescription>
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
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground",
				selected ? "bg-accent text-accent-foreground" : "",
			)}
		>
			<span className="flex-1">
				<span className="block text-sm">{template.name}</span>
				<span className="block text-xs text-muted-foreground">
					{template.is_active ? "active" : "inactive"}
				</span>
			</span>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={(event) => {
					event.stopPropagation();
					onDelete();
				}}
			>
				<Trash2 className="size-4" />
			</Button>
		</button>
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
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>New Template</DialogTitle>
				</DialogHeader>
				<Field label="Name" htmlFor="new-template-name">
					<Input
						id="new-template-name"
						autoFocus
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!name.trim() || submitting}
						onClick={() => onCreate(name.trim())}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
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
	const [deleteVariableId, setDeleteVariableId] = useState<string | null>(null);
	const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

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
		return <TemplateEditorSkeleton />;
	}
	if (detailQuery.error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{(detailQuery.error as Error).message}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<GlassCard className="p-6">
				<div className="flex flex-col gap-4">
					<Field label="Name" htmlFor="template-name">
						<Input
							id="template-name"
							value={draft.name}
							onChange={(event) =>
								setDraft({ ...draft, name: event.target.value })
							}
						/>
					</Field>
					<Field label="Description" htmlFor="template-description">
						<Textarea
							id="template-description"
							value={draft.description}
							onChange={(event) =>
								setDraft({ ...draft, description: event.target.value })
							}
							rows={2}
						/>
					</Field>
					<Field
						label="Contract text"
						htmlFor="template-contract-text"
						description={
							'Use {{variable}} to insert values and [IF {{var}} = "x" THEN {...} ELSE {...}] for conditional text.'
						}
					>
						<Textarea
							id="template-contract-text"
							className="max-h-[480px] min-h-48 font-mono"
							value={draft.contract_text}
							onChange={(event) =>
								setDraft({ ...draft, contract_text: event.target.value })
							}
							rows={8}
						/>
					</Field>
					<Label className="gap-2">
						<Checkbox
							checked={draft.is_active}
							onCheckedChange={(checked) =>
								setDraft({ ...draft, is_active: checked === true })
							}
						/>
						Active (visible to submitters)
					</Label>
					<div className="flex flex-row gap-2">
						<Button
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
							variant="outline"
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
					</div>
					{updateTemplate.error ? (
						<Alert variant="destructive">
							<AlertDescription>
								{(updateTemplate.error as Error).message}
							</AlertDescription>
						</Alert>
					) : null}
				</div>
			</GlassCard>

			<GlassCard className="p-6">
				<h2 className="mb-2 text-lg font-semibold">Variables</h2>
				<Separator className="mb-4" />
				{detail.variables.length > 0 ? (
					<>
						<div className="flex flex-col gap-2">
							{detail.variables.map((variable) => (
								<div
									key={variable.id}
									className="flex flex-row items-center gap-2"
								>
									<p className="flex-1">
										<code>{`{{${variable.variable_name}}}`}</code> —{" "}
										{variable.label}{" "}
										<span className="text-xs text-muted-foreground">
											(
											{DATA_TYPE_LABELS[variable.data_type] ??
												variable.data_type}
											{variable.is_required ? ", required" : ""})
										</span>
									</p>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={`Delete variable ${variable.label}`}
										onClick={() => setDeleteVariableId(variable.id)}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							))}
						</div>
						<Separator className="my-4" />
					</>
				) : null}
				<Collapsible>
					<CollapsibleTrigger asChild>
						<Button variant="outline" size="sm">
							<Plus className="size-4" />
							Add variable
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="pt-4">
						<NewVariableForm
							onSubmit={(values) => createVariable.mutate(values)}
							submitting={createVariable.isPending}
							error={createVariable.error as Error | null}
						/>
					</CollapsibleContent>
				</Collapsible>
			</GlassCard>

			<GlassCard className="p-6">
				<h2 className="mb-2 text-lg font-semibold">Conditional Blocks</h2>
				<Separator className="mb-4" />
				{detail.blocks.length > 0 ? (
					<>
						<div className="flex flex-col gap-2">
							{detail.blocks.map((block) => (
								<div key={block.id} className="flex flex-row items-start gap-2">
									<div className="flex-1">
										<p className="text-sm font-medium">{block.name}</p>
										<p className="text-xs text-muted-foreground">
											{CONDITION_TYPE_LABELS[block.condition_type] ??
												block.condition_type}
											{block.condition_variable
												? ` · ${block.condition_variable}`
												: ""}
											{block.condition_value
												? ` = ${block.condition_value}`
												: ""}
										</p>
										<p className="mt-0.5 whitespace-pre-wrap font-mono text-sm">
											{block.block_text}
										</p>
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={`Delete block ${block.name}`}
										onClick={() => setDeleteBlockId(block.id)}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							))}
						</div>
						<Separator className="my-4" />
					</>
				) : null}
				<Collapsible>
					<CollapsibleTrigger asChild>
						<Button variant="outline" size="sm">
							<Plus className="size-4" />
							Add block
						</Button>
					</CollapsibleTrigger>
					<CollapsibleContent className="pt-4">
						<NewBlockForm
							onSubmit={(values) => createBlock.mutate(values)}
							submitting={createBlock.isPending}
							error={createBlock.error as Error | null}
						/>
					</CollapsibleContent>
				</Collapsible>
			</GlassCard>

			<ConfirmDialog
				open={deleteVariableId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteVariableId(null);
				}}
				title="Delete variable?"
				description="This variable will be removed from the template."
				confirmLabel="Delete"
				destructive
				onConfirm={() => {
					if (deleteVariableId) deleteVariable.mutate(deleteVariableId);
				}}
			/>
			<ConfirmDialog
				open={deleteBlockId !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteBlockId(null);
				}}
				title="Delete block?"
				description="This conditional block will be removed from the template."
				confirmLabel="Delete"
				destructive
				onConfirm={() => {
					if (deleteBlockId) deleteBlock.mutate(deleteBlockId);
				}}
			/>
		</div>
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

	const VARIABLE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
	const variableNameInvalid =
		variableName.trim().length > 0 &&
		!VARIABLE_NAME_RE.test(variableName.trim());

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-row gap-2">
				<Field
					className="min-w-[120px] flex-1"
					label="Variable name"
					htmlFor="new-variable-name"
					error={
						variableNameInvalid
							? "Must start with a letter; only letters, digits, underscores allowed"
							: undefined
					}
				>
					<Input
						id="new-variable-name"
						className="h-8"
						placeholder="partner_name"
						value={variableName}
						onChange={(event) => setVariableName(event.target.value)}
						aria-invalid={variableNameInvalid}
					/>
				</Field>
				<Field
					className="min-w-[120px] flex-1"
					label="Label"
					htmlFor="new-variable-label"
				>
					<Input
						id="new-variable-label"
						className="h-8"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
					/>
				</Field>
				<Field
					className="min-w-[140px] flex-1"
					label="Type"
					htmlFor="new-variable-type"
				>
					<Select
						value={dataType}
						onValueChange={(value) =>
							setDataType(value as ContractVariableDataType)
						}
					>
						<SelectTrigger
							id="new-variable-type"
							size="sm"
							aria-label="Type"
							className="w-full"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DATA_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{DATA_TYPE_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Field label="Help text (optional)" htmlFor="new-variable-help">
				<Input
					id="new-variable-help"
					className="h-8"
					value={helpText}
					onChange={(event) => setHelpText(event.target.value)}
				/>
			</Field>
			{dataType === "SELECT" ? (
				<Field label="Options (comma-separated)" htmlFor="new-variable-options">
					<Input
						id="new-variable-options"
						className="h-8"
						value={optionsRaw}
						onChange={(event) => setOptionsRaw(event.target.value)}
					/>
				</Field>
			) : null}
			<Label className="gap-2">
				<Checkbox
					checked={required}
					onCheckedChange={(checked) => setRequired(checked === true)}
				/>
				Required field
			</Label>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button
					size="sm"
					disabled={
						!variableName.trim() ||
						variableNameInvalid ||
						!label.trim() ||
						submitting
					}
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
					Save variable
				</Button>
			</div>
		</div>
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
		<div className="flex flex-col gap-3">
			<div className="flex flex-row gap-2">
				<Field
					className="min-w-[120px] flex-1"
					label="Name"
					htmlFor="new-block-name"
				>
					<Input
						id="new-block-name"
						className="h-8"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				<Field
					className="min-w-[140px] flex-1"
					label="Condition"
					htmlFor="new-block-condition"
				>
					<Select
						value={conditionType}
						onValueChange={(value) =>
							setConditionType(value as ContractConditionType)
						}
					>
						<SelectTrigger
							id="new-block-condition"
							size="sm"
							aria-label="Condition"
							className="w-full"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CONDITION_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{CONDITION_TYPE_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				{needsVariable ? (
					<Field
						className="min-w-[100px] flex-1"
						label="Variable"
						htmlFor="new-block-variable"
					>
						<Input
							id="new-block-variable"
							className="h-8"
							value={conditionVariable}
							onChange={(event) => setConditionVariable(event.target.value)}
						/>
					</Field>
				) : null}
				{needsValue ? (
					<Field
						className="min-w-[100px] flex-1"
						label="Value"
						htmlFor="new-block-value"
					>
						<Input
							id="new-block-value"
							className="h-8"
							value={conditionValue}
							onChange={(event) => setConditionValue(event.target.value)}
						/>
					</Field>
				) : null}
			</div>
			<Field label="Block Text" htmlFor="new-block-text">
				<Textarea
					id="new-block-text"
					className="font-mono"
					value={blockText}
					onChange={(event) => setBlockText(event.target.value)}
					rows={3}
				/>
			</Field>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button
					size="sm"
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
					Save block
				</Button>
			</div>
		</div>
	);
}

function TemplateListSkeleton() {
	return (
		<SkeletonRegion
			label="Loading templates"
			className="flex flex-col gap-0.5 p-4"
		>
			{Array.from({ length: 6 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<div key={i} className="flex items-center gap-2 px-3 py-2">
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-12" />
					</div>
					<Skeleton className="size-8 shrink-0 rounded-md" />
				</div>
			))}
		</SkeletonRegion>
	);
}

function TemplateEditorSkeleton() {
	return (
		<SkeletonRegion label="Loading template" className="flex flex-col gap-6">
			<GlassCard className="p-6">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-9 w-full rounded-md" />
					</div>
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-16 w-full rounded-md" />
					</div>
					<div className="flex flex-col gap-1.5">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-48 w-full rounded-md" />
					</div>
					<Skeleton className="h-5 w-56" />
					<div className="flex flex-row gap-2">
						<Skeleton className="h-9 w-20 rounded-md" />
						<Skeleton className="h-9 w-20 rounded-md" />
					</div>
				</div>
			</GlassCard>
		</SkeletonRegion>
	);
}
