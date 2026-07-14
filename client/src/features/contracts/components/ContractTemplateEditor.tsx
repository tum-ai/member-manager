import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	CONTRACT_CONDITION_TYPE_LABELS,
	CONTRACT_DATA_TYPE_LABELS,
} from "@/features/contracts/contractTemplateOptions";
import type { ContractTemplateEditorViewModel } from "@/features/contracts/contractTemplatesPageTypes";
import { ContractCopyButton } from "./ContractCopyButton";
import { NewBlockForm, NewVariableForm } from "./ContractTemplateForms";
import { TemplateEditorSkeleton } from "./ContractTemplateSkeletons";

const RESERVED_SIGNATURE_TOKENS = [
	{
		token: "{{partner_signature}}",
		description: "Partner's signature, once they've signed.",
	},
	{
		token: "{{board_signature}}",
		description: "Board member's signature, once they've signed.",
	},
] as const;

export function TemplateEditor({
	model,
}: {
	model: ContractTemplateEditorViewModel;
}): JSX.Element {
	const { detail, draft } = model;
	if (model.loading || !detail || !draft) {
		return <TemplateEditorSkeleton />;
	}
	if (model.error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{model.error.message}</AlertDescription>
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
								model.setDraft({ ...draft, name: event.target.value })
							}
						/>
					</Field>
					<Field label="Description" htmlFor="template-description">
						<Textarea
							id="template-description"
							value={draft.description}
							onChange={(event) =>
								model.setDraft({ ...draft, description: event.target.value })
							}
							rows={2}
						/>
					</Field>
					<Field
						label="Contract text"
							htmlFor="template-contract-text"
							description={
								'Use {{variable}} to insert values and [IF {{var}} = "x" THEN {...} ELSE {...}] for conditional text. Reserved signature tokens are listed below.'
							}
					>
						<Textarea
							id="template-contract-text"
							className="max-h-[480px] min-h-48 font-mono"
							value={draft.contract_text}
							onChange={(event) =>
								model.setDraft({
									...draft,
									contract_text: event.target.value,
								})
							}
							rows={8}
						/>
					</Field>
					<Label className="gap-2">
						<Checkbox
							checked={draft.is_active}
							onCheckedChange={(checked) =>
								model.setDraft({ ...draft, is_active: checked === true })
							}
						/>
						Active (visible to submitters)
					</Label>
					<div className="flex flex-row gap-2">
						<Button
							disabled={!model.dirty || model.updatePending}
							onClick={model.save}
						>
							Save
						</Button>
						<Button
							variant="outline"
							disabled={!model.dirty}
							onClick={model.discard}
						>
							Discard
						</Button>
					</div>
					{model.updateError ? (
						<Alert variant="destructive">
							<AlertDescription>{model.updateError.message}</AlertDescription>
						</Alert>
					) : null}
				</div>
				</GlassCard>

				<GlassCard className="p-6">
					<h2 className="mb-2 text-lg font-semibold">
						Reserved signature tokens
					</h2>
					<Separator className="mb-4" />
					<p className="mb-3 text-sm text-muted-foreground">
						Place these in the contract text to draw signatures inline once
						signed. Without them, signatures render on a trailing page.
					</p>
					<div className="flex flex-col gap-2">
						{RESERVED_SIGNATURE_TOKENS.map(({ token, description }) => (
							<div key={token} className="flex items-center gap-2">
								<p className="flex-1">
									<code>{token}</code> -{" "}
									<span className="text-xs text-muted-foreground">
										{description}
									</span>
								</p>
								<ContractCopyButton
									value={token}
									ariaLabel={`Copy ${token}`}
								/>
							</div>
						))}
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
											{CONTRACT_DATA_TYPE_LABELS[variable.data_type] ??
												variable.data_type}
											{variable.is_required ? ", required" : ""})
										</span>
									</p>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={`Delete variable ${variable.label}`}
										onClick={() => model.setDeleteVariableId(variable.id)}
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
							onSubmit={model.createVariable}
							submitting={model.createVariablePending}
							error={model.createVariableError}
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
											{CONTRACT_CONDITION_TYPE_LABELS[block.condition_type] ??
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
										onClick={() => model.setDeleteBlockId(block.id)}
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
							onSubmit={model.createBlock}
							submitting={model.createBlockPending}
							error={model.createBlockError}
						/>
					</CollapsibleContent>
				</Collapsible>
			</GlassCard>

			<ConfirmDialog
				open={model.deleteVariableId !== null}
				onOpenChange={(open) => {
					if (!open) model.setDeleteVariableId(null);
				}}
				title="Delete variable?"
				description="This variable will be removed from the template."
				confirmLabel="Delete"
				destructive
				onConfirm={model.deleteVariable}
			/>
			<ConfirmDialog
				open={model.deleteBlockId !== null}
				onOpenChange={(open) => {
					if (!open) model.setDeleteBlockId(null);
				}}
				title="Delete block?"
				description="This conditional block will be removed from the template."
				confirmLabel="Delete"
				destructive
				onConfirm={model.deleteBlock}
			/>
		</div>
	);
}
