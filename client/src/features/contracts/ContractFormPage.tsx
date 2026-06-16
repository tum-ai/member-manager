import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { useCurrentUserIsAdmin } from "../../hooks/useCurrentUserIsAdmin";
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
	const initializedDraftId = useRef<string | null>(null);
	const {
		currentUserId,
		isAdmin,
		isLoading: isLoadingAdmin,
	} = useCurrentUserIsAdmin();
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
		>
			{templatesQuery.isLoading ||
			(isEditingDraft && draftQuery.isLoading) ||
			draftPermissionLoading ? (
				<ContractFormSkeleton />
			) : templatesQuery.error ? (
				<Alert variant="destructive">
					<AlertDescription>
						{(templatesQuery.error as Error).message}
					</AlertDescription>
				</Alert>
			) : draftQuery.error ? (
				<Alert variant="destructive">
					<AlertDescription>
						{(draftQuery.error as Error).message}
					</AlertDescription>
				</Alert>
			) : draftCannotBeEditedByUser ? (
				<Alert>
					<AlertDescription>
						Only the draft creator can edit this draft.
					</AlertDescription>
				</Alert>
			) : draftCannotBeEdited ? (
				<Alert>
					<AlertDescription>
						This draft has already been submitted and can no longer be edited
						here.
					</AlertDescription>
				</Alert>
			) : selectableTemplates.length === 0 ? (
				<Alert>
					<AlertDescription>
						No active templates are available.
					</AlertDescription>
				</Alert>
			) : (
				<div className="flex flex-col gap-6">
					{detailQuery.isLoading ? (
						<ContractFormSkeleton />
					) : detailQuery.data ? (
						<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
							<GlassCard className="w-full p-4">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="template-select">Template</Label>
									<Select
										value={selectedId || undefined}
										disabled={isEditingDraft}
										onValueChange={(value) => {
											setSelectedId(value);
											setFormData({});
										}}
									>
										<SelectTrigger
											id="template-select"
											className="w-full"
											aria-label="Template"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{selectableTemplates.map((template) => (
												<SelectItem key={template.id} value={template.id}>
													{template.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{isEditingDraft ? (
										<p className="text-xs text-muted-foreground">
											The template can't be changed after a draft is created.
										</p>
									) : null}
								</div>
								<Separator className="my-5" />
								<DynamicForm
									variables={detailQuery.data.variables}
									values={formData}
									onChange={setFormData}
									disabled={saving}
								/>
								<div className="mt-6 flex flex-row gap-2">
									<Button
										disabled={saving || missingRequired.length > 0}
										onClick={() => saveDraft("submitted")}
									>
										{isEditingDraft ? "Submit Draft" : "Submit"}
									</Button>
									<Button
										variant="outline"
										disabled={saving}
										onClick={() => saveDraft("draft")}
									>
										{isEditingDraft ? "Save Draft" : "Save as Draft"}
									</Button>
								</div>
								{missingRequired.length > 0 ? (
									<Alert className="mt-4">
										<AlertDescription>
											Required fields missing: {missingRequired.join(", ")}
										</AlertDescription>
									</Alert>
								) : null}
								{mutationError ? (
									<Alert variant="destructive" className="mt-4">
										<AlertDescription>
											{(mutationError as Error).message}
										</AlertDescription>
									</Alert>
								) : null}
							</GlassCard>
							<GlassCard className="relative min-w-0 overflow-hidden p-0 lg:sticky lg:top-6 lg:self-start">
								<span className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border bg-background/85 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
									Preview
								</span>
								{previewQuery.error ? (
									<Alert variant="destructive" className="m-4 w-auto">
										<AlertDescription>
											{(previewQuery.error as Error).message}
										</AlertDescription>
									</Alert>
								) : null}
								<ContractDocumentPreview
									pages={previewQuery.data?.pages}
									loading={previewQuery.isLoading || previewQuery.isFetching}
									// On mobile let the preview grow to its full height and
									// scroll with the page — a fixed-height inner scroll box
									// nested in the scrolling page traps touch gestures on iOS.
									// Desktop keeps the constrained, sticky scroll.
									maxHeight={{
										xs: "none",
										lg: "calc(100vh - 130px)",
									}}
									minHeight={{ xs: 420, lg: "calc(100vh - 130px)" }}
								/>
							</GlassCard>
						</div>
					) : null}
				</div>
			)}
		</ToolPageShell>
	);
}

function ContractFormSkeleton() {
	return (
		<SkeletonRegion
			label="Loading contract form"
			className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]"
		>
			<GlassCard className="w-full p-4">
				<div className="flex flex-col gap-1.5">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-9 w-full rounded-md" />
				</div>
				<Separator className="my-5" />
				<div className="flex flex-col gap-5">
					{Array.from({ length: 5 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-9 w-full rounded-md" />
						</div>
					))}
				</div>
				<div className="mt-6 flex flex-row gap-2">
					<Skeleton className="h-9 w-24 rounded-md" />
					<Skeleton className="h-9 w-28 rounded-md" />
				</div>
			</GlassCard>
			<GlassCard className="min-w-0 overflow-hidden p-0 lg:sticky lg:top-6 lg:self-start">
				<Skeleton className="aspect-[1/1.414] w-full rounded-none" />
			</GlassCard>
		</SkeletonRegion>
	);
}
