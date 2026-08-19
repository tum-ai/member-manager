import type { ContractDocxReadiness } from "@member-manager/shared";
import { CheckCircle2, FileWarning, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";

export function ContractDocxReadinessPanel({
	readiness,
	loading,
	error,
	cutoverPending,
	cutoverError,
	enabled,
	cutoverTarget,
	onRequestCutover,
	onCancelCutover,
	onConfirmCutover,
}: {
	readiness: ContractDocxReadiness | undefined;
	loading: boolean;
	error: Error | null;
	cutoverPending: boolean;
	cutoverError: Error | null;
	enabled: boolean;
	cutoverTarget: boolean | null;
	onRequestCutover: (enabled: boolean) => void;
	onCancelCutover: () => void;
	onConfirmCutover: () => void;
}): JSX.Element | null {
	if (loading) return <Skeleton className="mb-6 h-36 w-full rounded-xl" />;
	if (error) {
		return (
			<Alert variant="destructive" className="mb-6">
				<AlertDescription>{error.message}</AlertDescription>
			</Alert>
		);
	}
	if (!readiness) return null;

	const metrics = [
		["DOCX templates", readiness.active_docx_templates],
		["Legacy templates", readiness.legacy_templates],
		["Pending documents", readiness.pending_template_documents],
		["Failed documents", readiness.failed_template_documents],
		["Pending renders", readiness.pending_render_jobs],
		["Failed renders", readiness.failed_render_jobs],
	] as const;

	return (
		<>
			<GlassCard className="mb-6 p-5 sm:p-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex gap-3">
						<div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
							{readiness.ready ? (
								<ShieldCheck className="size-5" />
							) : (
								<FileWarning className="size-5" />
							)}
						</div>
						<div>
							<h2 className="font-semibold">DOCX cutover readiness</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{enabled
									? "Stored PDFs are active for future submissions. Existing submissions remain unchanged."
									: readiness.ready
										? "All required artifacts are ready for the stored PDF workflow."
										: "Resolve every blocker before enabling the stored PDF workflow."}
							</p>
						</div>
					</div>
					<Button
						variant={enabled ? "outline" : "default"}
						disabled={(!enabled && !readiness.ready) || cutoverPending}
						onClick={() => onRequestCutover(!enabled)}
					>
						<CheckCircle2 className="size-4" />
						{cutoverPending
							? "Updating…"
							: enabled
								? "Pause DOCX for future submissions"
								: "Enable DOCX cutover"}
					</Button>
				</div>
				<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{metrics.map(([label, value]) => (
						<div
							key={label}
							className="rounded-lg bg-muted/50 p-3 dark:bg-brand/5"
						>
							<p className="text-2xl font-semibold">{value}</p>
							<p className="text-xs text-muted-foreground">{label}</p>
						</div>
					))}
				</div>
				{readiness.reasons.length > 0 ? (
					<ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
						{readiness.reasons.map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
				) : null}
				{cutoverError ? (
					<Alert variant="destructive" className="mt-4">
						<AlertDescription>{cutoverError.message}</AlertDescription>
					</Alert>
				) : null}
			</GlassCard>
			<ConfirmDialog
				open={cutoverTarget !== null}
				onOpenChange={(open) => {
					if (!open) onCancelCutover();
				}}
				title={
					cutoverTarget
						? "Enable the DOCX workflow?"
						: "Pause DOCX for future submissions?"
				}
				description={
					cutoverTarget
						? "Future submissions will use converted and stored PDFs. Existing submissions remain unchanged, and immutable template versions remain available for rollback."
						: "Future submissions will return to the legacy workflow. Existing submissions and stored documents remain unchanged."
				}
				confirmLabel={cutoverTarget ? "Enable cutover" : "Pause cutover"}
				destructive={cutoverTarget === false}
				onConfirm={onConfirmCutover}
			/>
		</>
	);
}
