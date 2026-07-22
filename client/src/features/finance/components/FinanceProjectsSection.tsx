import type {
	FinancePlanTemplate,
	FinancePlanTemplateCreate,
	FinanceProject,
	FinanceProjectCreate,
	FinanceProjectStatus,
} from "@member-manager/shared";
import { FolderTree, Loader2, WandSparkles } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { FinancePeriod } from "@/features/finance/financeUtils";
import {
	formatBereichLabel,
	formatFinanceAmount,
	formatFinancePeriodLabel,
} from "@/features/finance/financeUtils";
import type {
	DeleteTemplateItemInput,
	TemplateAssignmentInput,
	TemplateItemMutationInput,
} from "@/features/finance/hooks/useFinanceManagement";
import { FinanceManagementPeriodControls } from "./FinanceManagementPeriodControls";
import { FinanceProjectCreateForm } from "./FinanceProjectCreateForm";
import { FinanceTemplateManager } from "./FinanceTemplateManager";

const STATUS_LABELS: Record<FinanceProjectStatus, string> = {
	draft: "Entwurf",
	active: "Aktiv",
	completed: "Abgeschlossen",
	cancelled: "Storniert",
};

const STATUS_VARIANTS: Record<FinanceProjectStatus, BadgeVariant> = {
	draft: "neutral",
	active: "success",
	completed: "accent",
	cancelled: "danger",
};

export interface FinanceProjectsSectionProps {
	period: FinancePeriod;
	projects: FinanceProject[];
	templates: FinancePlanTemplate[];
	department: string | null;
	canManage: boolean;
	isLoading: boolean;
	error: Error | null;
	isCreatingProject: boolean;
	isCreatingTemplate: boolean;
	pendingTemplateItemId: string | null;
	pendingAssignmentProjectId: string | null;
	deletingTemplateItemId: string | null;
	onPeriodTypeChange: (type: FinanceProject["period_type"]) => void;
	onPeriodKeyChange: (key: string) => void;
	onCreateProject: (input: FinanceProjectCreate) => Promise<void>;
	onCreateTemplate: (input: FinancePlanTemplateCreate) => Promise<void>;
	onCreateTemplateItem: (input: TemplateItemMutationInput) => Promise<void>;
	onDeleteTemplateItem: (input: DeleteTemplateItemInput) => Promise<void>;
	onAssignTemplate: (input: TemplateAssignmentInput) => Promise<void>;
}

export function FinanceProjectsSection({
	period,
	projects,
	templates,
	department,
	canManage,
	isLoading,
	error,
	isCreatingProject,
	isCreatingTemplate,
	pendingTemplateItemId,
	pendingAssignmentProjectId,
	deletingTemplateItemId,
	onPeriodTypeChange,
	onPeriodKeyChange,
	onCreateProject,
	onCreateTemplate,
	onCreateTemplateItem,
	onDeleteTemplateItem,
	onAssignTemplate,
}: FinanceProjectsSectionProps): ReactElement {
	const parentNames = useMemo(
		() => new Map(projects.map((project) => [project.id, project.name])),
		[projects],
	);

	return (
		<div className="flex flex-col gap-4">
			<FinanceManagementPeriodControls
				idPrefix="finance-projects"
				period={period}
				onPeriodTypeChange={onPeriodTypeChange}
				onPeriodKeyChange={onPeriodKeyChange}
			/>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}

			<FinanceProjectCreateForm
				period={period}
				projects={projects}
				department={department}
				canManage={canManage}
				isPending={isCreatingProject}
				onCreate={onCreateProject}
			/>

			<section
				aria-labelledby="finance-project-list-heading"
				className="overflow-hidden rounded-md border bg-card shadow-sm"
			>
				<div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
					<div>
						<h3
							id="finance-project-list-heading"
							className="text-sm font-semibold"
						>
							Projekte
						</h3>
						<p className="text-xs text-muted-foreground">
							{formatFinancePeriodLabel(period)} · {projects.length} Einträge
						</p>
					</div>
					<FolderTree className="size-4 text-brand" aria-hidden="true" />
				</div>
				{isLoading ? (
					<div className="p-4">
						<Skeleton className="h-52 w-full" />
					</div>
				) : (
					<div className="scrollbar-thin overflow-x-auto">
						<Table className="min-w-[980px]">
							<TableHeader>
								<TableRow>
									<TableHead>Projekt</TableHead>
									<TableHead>Department</TableHead>
									<TableHead>Parent</TableHead>
									<TableHead>Steuerbereich</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Ziel</TableHead>
									<TableHead className="w-72">Vorlage anwenden</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{projects.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={7}
											className="h-24 text-center text-muted-foreground"
										>
											Keine Projekte in diesem Zeitraum.
										</TableCell>
									</TableRow>
								) : (
									projects.map((project) => (
										<ProjectRow
											key={project.id}
											project={project}
											parentName={
												project.parent_project_id
													? parentNames.get(project.parent_project_id)
													: undefined
											}
											templates={templates}
											isPending={pendingAssignmentProjectId === project.id}
											onAssign={onAssignTemplate}
										/>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</section>

			<FinanceTemplateManager
				templates={templates}
				canManage={canManage}
				isCreatingTemplate={isCreatingTemplate}
				pendingTemplateItemId={pendingTemplateItemId}
				deletingTemplateItemId={deletingTemplateItemId}
				onCreateTemplate={onCreateTemplate}
				onCreateTemplateItem={onCreateTemplateItem}
				onDeleteTemplateItem={onDeleteTemplateItem}
			/>
		</div>
	);
}

function ProjectRow({
	project,
	parentName,
	templates,
	isPending,
	onAssign,
}: {
	project: FinanceProject;
	parentName?: string;
	templates: FinancePlanTemplate[];
	isPending: boolean;
	onAssign: (input: TemplateAssignmentInput) => Promise<void>;
}): ReactElement {
	const [templateId, setTemplateId] = useState("");
	const activeTemplates = templates.filter((template) => template.is_active);

	async function assign(): Promise<void> {
		if (!templateId) {
			return;
		}
		const succeeded = await onAssign({
			projectId: project.id,
			templateId,
		}).then(
			() => true,
			() => false,
		);
		if (succeeded) {
			setTemplateId("");
		}
	}

	return (
		<TableRow>
			<TableCell>
				<div className="font-medium">{project.name}</div>
				{project.description ? (
					<div className="max-w-64 truncate text-xs text-muted-foreground">
						{project.description}
					</div>
				) : null}
			</TableCell>
			<TableCell>{project.department}</TableCell>
			<TableCell>{parentName ?? "—"}</TableCell>
			<TableCell>{formatBereichLabel(project.tax_area)}</TableCell>
			<TableCell>
				<Badge variant={STATUS_VARIANTS[project.status]}>
					{STATUS_LABELS[project.status]}
				</Badge>
			</TableCell>
			<TableCell
				className={`text-right font-medium tabular-nums ${
					project.target_amount < 0 ? "text-destructive" : ""
				}`}
			>
				{formatFinanceAmount(project.target_amount)}
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-2">
					<Select value={templateId} onValueChange={setTemplateId}>
						<SelectTrigger
							className="min-w-0 flex-1"
							aria-label={`Vorlage für ${project.name}`}
						>
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
					<Button
						type="button"
						size="icon-sm"
						variant="outline"
						disabled={!templateId || isPending}
						aria-label={`Vorlage auf ${project.name} anwenden`}
						onClick={() => {
							void assign();
						}}
					>
						{isPending ? (
							<Loader2 className="animate-spin" />
						) : (
							<WandSparkles />
						)}
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}
