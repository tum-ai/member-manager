import { PanelRight, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { ToolPageShell } from "@/features/tools/ToolPageShell";
import {
	NewTemplateDialog,
	TemplateListItem,
} from "./components/ContractTemplateDialogs";
import { TemplateEditor } from "./components/ContractTemplateEditor";
import { TemplateListSkeleton } from "./components/ContractTemplateSkeletons";
import { useContractTemplatesPage } from "./hooks/useContractTemplatesPage";

export default function ContractTemplatesPage(): JSX.Element {
	const templates = useContractTemplatesPage();

	return (
		<ToolPageShell title="Manage Templates">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<Sheet open={templates.listOpen} onOpenChange={templates.setListOpen}>
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
								{templates.templatesLoading ? <TemplateListSkeleton /> : null}
								{templates.templatesError ? (
									<Alert variant="destructive">
										<AlertDescription>
											{templates.templatesError.message}
										</AlertDescription>
									</Alert>
								) : null}
								<div className="flex flex-col gap-0.5">
									{templates.templates.map((template) => (
										<TemplateListItem
											key={template.id}
											template={template}
											selected={templates.selectedId === template.id}
											onSelect={() => templates.selectTemplate(template.id)}
											onDelete={() => templates.setDeleteTarget(template)}
										/>
									))}
									{!templates.templatesLoading &&
									templates.templates.length === 0 ? (
										<p className="p-2 text-sm text-muted-foreground">
											No templates yet.
										</p>
									) : null}
								</div>
							</div>
						</SheetContent>
					</Sheet>
					{templates.selectedTemplate ? (
						<p className="truncate text-sm text-muted-foreground">
							Editing{" "}
							<span className="font-medium text-foreground">
								{templates.selectedTemplate.name}
							</span>
						</p>
					) : null}
				</div>
				<Button onClick={() => templates.setNewTemplateOpen(true)}>
					<Plus className="size-4" />
					New template
				</Button>
			</div>

			<div className="min-w-0">
				{templates.selectedId ? (
					<TemplateEditor model={templates.editor} />
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
				open={templates.deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) templates.setDeleteTarget(null);
				}}
				title="Delete template?"
				description={
					templates.deleteTarget
						? `"${templates.deleteTarget.name}" and its variables and blocks will be permanently removed.`
						: undefined
				}
				confirmLabel="Delete"
				destructive
				onConfirm={templates.deleteTemplate}
			/>

			<NewTemplateDialog
				open={templates.newTemplateOpen}
				onClose={() => templates.setNewTemplateOpen(false)}
				onCreate={templates.createTemplate}
				submitting={templates.createTemplatePending}
				error={templates.createTemplateError}
			/>
			{templates.deleteTemplateError ? (
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>
						{templates.deleteTemplateError.message}
					</AlertDescription>
				</Alert>
			) : null}
		</ToolPageShell>
	);
}
