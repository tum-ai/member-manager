import { CircleCheck, TriangleAlert } from "lucide-react";
import type React from "react";
import { Separator } from "@/components/ui/separator";
import type { ContractSubmission } from "@/features/contracts/useContracts";
import { cn } from "@/lib/utils";

type ActivityTone = "success" | "error";

function ActivityRow({
	tone,
	children,
}: {
	tone: ActivityTone;
	children: React.ReactNode;
}): JSX.Element {
	const Icon = tone === "error" ? TriangleAlert : CircleCheck;
	return (
		<div className="flex items-start gap-2 text-sm">
			<Icon
				className={cn(
					"mt-0.5 size-4 shrink-0",
					tone === "error" ? "text-destructive" : "text-emerald-600",
				)}
			/>
			<span className="text-muted-foreground">{children}</span>
		</div>
	);
}

/**
 * Delivery / notification activity log for a contract (partner email, OpenSign,
 * clarification email). Presentational; renders nothing when there is no
 * activity yet.
 */
export function ContractActivitySection({
	submission,
}: {
	submission: ContractSubmission;
}): JSX.Element | null {
	const hasActivity =
		submission.partner_email_sent_at ||
		submission.partner_email_error ||
		submission.clarification_email_sent_at ||
		submission.clarification_email_error ||
		submission.opensign_sent_at ||
		submission.opensign_completed_at ||
		submission.opensign_error;
	if (!hasActivity) return null;

	return (
		<>
			<Separator className="my-5" />
			<p className="mb-3 text-sm font-medium">Activity</p>
			<div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
				{submission.partner_email_sent_at ? (
					<ActivityRow tone="success">
						Email sent to {submission.partner_email_recipient} at{" "}
						{new Date(submission.partner_email_sent_at).toLocaleString()}
					</ActivityRow>
				) : null}
				{submission.partner_email_error ? (
					<ActivityRow tone="error">
						Last email error: {submission.partner_email_error}
					</ActivityRow>
				) : null}
				{submission.clarification_email_sent_at ? (
					<ActivityRow tone="success">
						Clarification email sent to{" "}
						{submission.clarification_email_recipient} at{" "}
						{new Date(submission.clarification_email_sent_at).toLocaleString()}
					</ActivityRow>
				) : null}
				{submission.clarification_email_error ? (
					<ActivityRow tone="error">
						Clarification email error: {submission.clarification_email_error}
					</ActivityRow>
				) : null}
				{submission.opensign_sent_at ? (
					<ActivityRow tone="success">
						OpenSign document {submission.opensign_document_id} sent at{" "}
						{new Date(submission.opensign_sent_at).toLocaleString()}
						{submission.opensign_status
							? ` (${submission.opensign_status})`
							: ""}
					</ActivityRow>
				) : null}
				{submission.opensign_completed_at ? (
					<ActivityRow tone="success">
						OpenSign completed at{" "}
						{new Date(submission.opensign_completed_at).toLocaleString()}
					</ActivityRow>
				) : null}
				{submission.opensign_error ? (
					<ActivityRow tone="error">
						Last OpenSign error: {submission.opensign_error}
					</ActivityRow>
				) : null}
			</div>
		</>
	);
}
