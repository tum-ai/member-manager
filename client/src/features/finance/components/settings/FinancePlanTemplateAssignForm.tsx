import type {
	FinancePlanTemplate,
	FinanceProject,
} from "@member-manager/shared";
import { Loader2, WandSparkles } from "lucide-react";
import { type ReactElement, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import { formatFinancePeriodLabel } from "@/features/finance/financeUtils";

interface FinancePlanTemplateAssignFormProps {
	period: FinancePeriod;
	projects: FinanceProject[];
	templates: FinancePlanTemplate[];
	pendingProjectId: string | null;
	onAssign: (projectId: string, templateId: string) => Promise<void>;
}

// Applying a plan template to a project used to hang off each row of the
// project table; that table went away with the Projekte tab (FR-O), and
// templates are a setup concern, so the action lives here next to the templates
// themselves. Projects are created in the T-view now — this only fills one.
export function FinancePlanTemplateAssignForm({
	period,
	projects,
	templates,
	pendingProjectId,
	onAssign,
}: FinancePlanTemplateAssignFormProps): ReactElement {
	const fieldId = useId();
	const [projectId, setProjectId] = useState("");
	const [templateId, setTemplateId] = useState("");

	const activeTemplates = templates.filter((template) => template.is_active);
	const isPending = pendingProjectId !== null && pendingProjectId === projectId;
	const canSubmit = projectId !== "" && templateId !== "" && !isPending;

	async function submit(): Promise<void> {
		if (!canSubmit) return;
		await onAssign(projectId, templateId);
		setTemplateId("");
	}

	return (
		<section
			aria-labelledby="finance-template-assign-heading"
			className="rounded-md border bg-card p-4 shadow-sm"
		>
			<h3
				id="finance-template-assign-heading"
				className="text-sm font-semibold"
			>
				Vorlage auf Projekt anwenden
			</h3>
			<p className="mt-1 text-xs text-muted-foreground">
				Legt die Planposten der Vorlage im gewählten Projekt an ·{" "}
				{formatFinancePeriodLabel(period)}
			</p>

			<div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
				<Field label="Projekt" htmlFor={`${fieldId}-project`}>
					{projects.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Für diesen Zeitraum gibt es noch kein Projekt. Projekte werden im
							T-Konto angelegt.
						</p>
					) : (
						<Select value={projectId} onValueChange={setProjectId}>
							<SelectTrigger id={`${fieldId}-project`} aria-label="Projekt">
								<SelectValue placeholder="Projekt wählen" />
							</SelectTrigger>
							<SelectContent>
								{projects.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										{project.name} · {project.department}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				<Field label="Vorlage" htmlFor={`${fieldId}-template`}>
					<Select value={templateId} onValueChange={setTemplateId}>
						<SelectTrigger id={`${fieldId}-template`} aria-label="Vorlage">
							<SelectValue placeholder="Vorlage wählen" />
						</SelectTrigger>
						<SelectContent>
							{activeTemplates.map((template) => (
								<SelectItem key={template.id} value={template.id}>
									{template.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<Button
					type="button"
					variant="outline"
					disabled={!canSubmit}
					onClick={() => {
						void submit();
					}}
				>
					{isPending ? <Loader2 className="animate-spin" /> : <WandSparkles />}
					Anwenden
				</Button>
			</div>
		</section>
	);
}
