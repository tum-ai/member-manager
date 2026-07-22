import type {
	BuchhaltungsButlerTransaction,
	FinancePlanItem,
	FinanceProject,
} from "@member-manager/shared";
import { Check, ChevronsUpDown, Save } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ReimbursementRequest } from "@/features/reimbursements/reimbursementTypes";
import { cn } from "@/lib/utils";

const NO_PROJECT = "__none__";
const NO_PLAN_ITEM = "__none__";

type FinancePlanItemOption = FinancePlanItem & {
	project_id?: string | null;
};

interface ReimbursementFinanceLinkEditorProps {
	request: ReimbursementRequest;
	projects: FinanceProject[];
	planItems: FinancePlanItemOption[];
	postings: BuchhaltungsButlerTransaction[];
	disabled: boolean;
	onSave: (
		financeProjectId: string | null,
		financePlanItemId: string | null,
		bbPostingExternalId: string | null,
	) => Promise<void>;
}

export function ReimbursementFinanceLinkEditor({
	request,
	projects,
	planItems,
	postings,
	disabled,
	onSave,
}: ReimbursementFinanceLinkEditorProps): ReactElement {
	const [projectId, setProjectId] = useState(
		request.finance_project_id ?? NO_PROJECT,
	);
	const [planItemId, setPlanItemId] = useState(
		request.finance_plan_item_id ?? NO_PLAN_ITEM,
	);
	const [postingExternalId, setPostingExternalId] = useState(
		request.bb_posting_external_id ?? "",
	);
	const [postingPickerOpen, setPostingPickerOpen] = useState(false);
	const availableProjects = projects.filter(
		(project) =>
			project.department === request.department &&
			(project.status !== "cancelled" ||
				project.id === request.finance_project_id),
	);
	const selectedProject = availableProjects.find(
		(project) => project.id === projectId,
	);
	const availablePlanItems = useMemo(
		() =>
			planItems.filter((item) => {
				if (item.department !== request.department) return false;
				if (!selectedProject) return true;
				if (
					selectedProject.id === request.finance_project_id &&
					item.id === request.finance_plan_item_id
				) {
					return true;
				}
				if (item.project_id === selectedProject.id) return true;
				return (
					item.project_id === null &&
					item.period_type === selectedProject.period_type &&
					item.period_key === selectedProject.period_key
				);
			}),
		[
			planItems,
			request.department,
			request.finance_plan_item_id,
			request.finance_project_id,
			selectedProject,
		],
	);
	const selectedPlanItemIsAvailable = availablePlanItems.some(
		(item) => item.id === planItemId,
	);
	const selectedPosting = postings.find(
		(posting) => posting.external_id === postingExternalId,
	);

	useEffect(() => {
		setProjectId(request.finance_project_id ?? NO_PROJECT);
		setPlanItemId(request.finance_plan_item_id ?? NO_PLAN_ITEM);
		setPostingExternalId(request.bb_posting_external_id ?? "");
	}, [
		request.bb_posting_external_id,
		request.finance_plan_item_id,
		request.finance_project_id,
	]);

	const handleProjectChange = (nextProjectId: string): void => {
		setProjectId(nextProjectId);
		if (nextProjectId !== projectId) {
			setPlanItemId(NO_PLAN_ITEM);
		}
	};

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
			<div className="grid gap-1.5">
				<Label htmlFor={`reimbursement-project-${request.id}`}>Project</Label>
				<Select
					value={projectId}
					onValueChange={handleProjectChange}
					disabled={disabled}
				>
					<SelectTrigger
						id={`reimbursement-project-${request.id}`}
						aria-label="Finance project"
					>
						<SelectValue placeholder="No project" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_PROJECT}>No project</SelectItem>
						{availableProjects.map((project) => (
							<SelectItem key={project.id} value={project.id}>
								{project.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`reimbursement-plan-item-${request.id}`}>
					Plan item
				</Label>
				<Select
					value={planItemId}
					onValueChange={setPlanItemId}
					disabled={disabled}
				>
					<SelectTrigger
						id={`reimbursement-plan-item-${request.id}`}
						aria-label="Finance plan item"
					>
						<SelectValue placeholder="No plan item" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_PLAN_ITEM}>No plan item</SelectItem>
						{!selectedPlanItemIsAvailable && planItemId !== NO_PLAN_ITEM && (
							<SelectItem value={planItemId}>
								Linked plan item ({planItemId})
							</SelectItem>
						)}
						{availablePlanItems.map((item) => (
							<SelectItem key={item.id} value={item.id}>
								{item.label} ({item.period_key})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`reimbursement-posting-${request.id}`}>
					BB posting
				</Label>
				<Popover open={postingPickerOpen} onOpenChange={setPostingPickerOpen}>
					<PopoverTrigger asChild>
						<Button
							id={`reimbursement-posting-${request.id}`}
							type="button"
							variant="outline"
							role="combobox"
							aria-label="BB posting"
							aria-expanded={postingPickerOpen}
							disabled={disabled}
							className="min-w-0 justify-between font-normal"
						>
							<span className="truncate">
								{selectedPosting
									? `${selectedPosting.date} · ${selectedPosting.postingtext}`
									: postingExternalId
										? `Linked posting (${postingExternalId})`
										: "No posting"}
							</span>
							<ChevronsUpDown className="opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-(--radix-popover-trigger-width) p-0">
						<Command>
							<CommandInput placeholder="Search BB postings..." />
							<CommandList>
								<CommandEmpty>No BB posting found.</CommandEmpty>
								<CommandGroup>
									<CommandItem
										value="no posting clear link"
										onSelect={() => {
											setPostingExternalId("");
											setPostingPickerOpen(false);
										}}
									>
										<Check
											className={cn(
												"size-4",
												postingExternalId ? "opacity-0" : "opacity-100",
											)}
										/>
										No posting
									</CommandItem>
									{postings.map((posting) => (
										<CommandItem
											key={posting.external_id}
											value={[
												posting.external_id,
												posting.date,
												posting.postingtext,
												posting.transaction_purpose,
												String(posting.transaction_amount),
											].join(" ")}
											onSelect={() => {
												setPostingExternalId(posting.external_id);
												setPostingPickerOpen(false);
											}}
										>
											<Check
												className={cn(
													"size-4",
													posting.external_id === postingExternalId
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											<span className="min-w-0">
												<span className="block truncate">
													{posting.date} · {posting.postingtext}
												</span>
												<span className="block truncate text-xs text-muted-foreground">
													{posting.transaction_amount.toLocaleString("de-DE", {
														style: "currency",
														currency: posting.currency || "EUR",
													})}{" "}
													· {posting.external_id}
												</span>
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>
			<Button
				type="button"
				variant="outline"
				onClick={() => {
					void onSave(
						projectId === NO_PROJECT ? null : projectId,
						planItemId === NO_PLAN_ITEM ? null : planItemId,
						postingExternalId.trim() || null,
					);
				}}
				disabled={disabled}
			>
				<Save />
				Save links
			</Button>
		</div>
	);
}
