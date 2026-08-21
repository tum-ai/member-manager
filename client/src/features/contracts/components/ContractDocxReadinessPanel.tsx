import type { ContractDocxReadiness } from "@member-manager/shared";
import { FileWarning, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";

export function ContractDocxReadinessPanel({
	readiness,
	loading,
	error,
}: {
	readiness: ContractDocxReadiness | undefined;
	loading: boolean;
	error: Error | null;
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
		["Templates needing DOCX", readiness.templates_without_ready_docx],
		["Pending documents", readiness.pending_template_documents],
		["Failed documents", readiness.failed_template_documents],
		["Pending renders", readiness.pending_render_jobs],
		["Failed renders", readiness.failed_render_jobs],
	] as const;

	return (
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
						<h2 className="font-semibold">DOCX workflow readiness</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							Stored PDFs are the only workflow for new contracts. Upload and
							activate a ready DOCX version for every active template.
						</p>
					</div>
				</div>
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
		</GlassCard>
	);
}
