import type { ContractSubmission } from "@member-manager/shared";
import { ExternalLink } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { ContractActivitySection } from "./ContractActivitySection";
import { ContractCopyButton } from "./ContractCopyButton";

export function ContractSubmissionActionsSection({
	submission,
	detail,
}: {
	submission: ContractSubmission;
	detail: ContractSubmissionDetailViewModel;
}): JSX.Element {
	return (
		<>
			<GlassCard className="p-6">
			<p className="mb-4 text-base font-medium">Actions</p>

			{detail.actionError ? (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>
						{detail.actionError instanceof Error
							? detail.actionError.message
							: "Action failed"}
					</AlertDescription>
				</Alert>
			) : null}
			{detail.downloadError ? (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{detail.downloadError}</AlertDescription>
				</Alert>
			) : null}

			{/* Document actions */}
							<div className="flex flex-row flex-wrap gap-2">
				{detail.canEditDraft ? (
					<Button variant="outline" asChild>
						<RouterLink to={`/contracts/drafts/${submission.id}`}>
							Edit draft
						</RouterLink>
					</Button>
				) : null}
				{detail.isContractsAdmin ? (
					<Button disabled={detail.busy} onClick={detail.saveChanges}>
						Save changes
					</Button>
				) : null}
				<Button
					variant="outline"
					disabled={detail.busy || detail.downloading}
					onClick={detail.downloadPdf}
				>
					{detail.downloading ? "Downloading..." : "Download PDF"}
				</Button>
			</div>

			{detail.isContractsAdmin ? (
				<>
					<Separator className="my-5" />

					{/* Send to partner */}
					<p className="mb-3 text-sm font-medium">Send to partner</p>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="partner-email-subject">Email subject</Label>
							<Input
								id="partner-email-subject"
								value={detail.partnerEmailSubject}
								onChange={(event) =>
									detail.setPartnerEmailSubject(event.target.value)
								}
							/>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="partner-email-message">Email message</Label>
							<Textarea
								id="partner-email-message"
								value={detail.partnerEmailMessage}
								onChange={(event) =>
									detail.setPartnerEmailMessage(event.target.value)
								}
								rows={2}
							/>
						</div>
						{!detail.canSendToPartner ? (
							<p className="text-sm text-muted-foreground">
								Approve the contract below before sending it to the partner.
							</p>
						) : null}
						<div className="flex flex-row flex-wrap gap-2">
							<Button
								disabled={detail.busy || !detail.canSendToPartner}
								onClick={detail.sendToPartner}
							>
								Send to partner
							</Button>
							<Button
								disabled={detail.busy || !detail.canSendToPartner}
								onClick={detail.sendEmailToPartner}
							>
								Send email to partner
							</Button>
							<Button
								disabled={detail.busy || !detail.canSendToPartner}
								onClick={detail.sendWithOpenSign}
							>
								Send with OpenSign
							</Button>
							</div>
							<Label className="gap-2 font-normal">
								<Checkbox
									checked={submission.auto_send_after_board_signed === true}
									onCheckedChange={(checked) =>
										detail.setAutoSendAfterBoardSigned(checked === true)
									}
									disabled={detail.busy}
								/>
								Auto-send to partner after board signs
							</Label>
							{detail.signUrl ? (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="sign-url">Signing link (send to partner)</Label>
								<div className="flex items-center gap-1">
									<Input id="sign-url" value={detail.signUrl} readOnly />
									<ContractCopyButton value={detail.signUrl} />
								</div>
							</div>
						) : null}
					</div>

					<Separator className="my-5" />

					{/* Decision */}
					<p className="mb-3 text-sm font-medium">Decision</p>
					<div className="flex flex-col gap-4">
						{detail.canRequestClarification ? (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="clarification-message">
									Clarification message
								</Label>
								<Textarea
									id="clarification-message"
									value={detail.clarificationMessage}
									onChange={(event) =>
										detail.setClarificationMessage(event.target.value)
									}
									rows={2}
								/>
							</div>
						) : null}
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="reject-reason">Rejection reason</Label>
							<Textarea
								id="reject-reason"
								value={detail.rejectReason}
								onChange={(event) => detail.setRejectReason(event.target.value)}
								rows={2}
								placeholder="Required to reject — sent to the contract creator."
							/>
						</div>
						<div className="flex flex-row flex-wrap gap-2">
							{detail.canApprove ? (
								<Button
									className="bg-emerald-600 text-white hover:bg-emerald-700"
									disabled={detail.busy}
									onClick={detail.approve}
								>
									Approve
								</Button>
							) : null}
							{detail.canRequestClarification ? (
								<Button
									variant="outline"
									className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
									disabled={detail.busy}
									onClick={detail.requestClarification}
								>
									Request clarification
								</Button>
							) : null}
							<Button
								variant="outline"
								className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
								disabled={detail.busy || !detail.rejectReason.trim()}
								onClick={detail.reject}
							>
								Reject
							</Button>
						</div>
					</div>

					<ContractActivitySection submission={submission} />
				</>
			) : null}

			{detail.finalPdfUrl ? (
				<>
					<Separator className="my-5" />
					<p className="mb-3 text-sm font-medium">Final PDF</p>
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center gap-1">
							<Input value={detail.finalPdfUrl} readOnly />
							<ContractCopyButton value={detail.finalPdfUrl} />
						</div>
						<div className="mt-1 flex flex-row gap-2">
							<Button variant="ghost" asChild>
								<a href={detail.finalPdfUrl} target="_blank" rel="noreferrer">
									<ExternalLink className="size-4" />
									Open final PDF
								</a>
							</Button>
							<Button variant="outline" asChild>
								<a
									href={`${detail.finalPdfUrl}?download=1`}
									target="_blank"
									rel="noreferrer"
								>
									Download final PDF
								</a>
							</Button>
						</div>
					</div>
				</>
			) : null}
			</GlassCard>
			<ConfirmDialog
				open={detail.resendConfirmationOpen}
				onOpenChange={(open) => {
					if (!open) detail.cancelResend();
				}}
				title="Send again to partner?"
				description="This contract was already sent to the partner. Send it again via the selected method?"
				confirmLabel="Send again"
				onConfirm={detail.confirmResend}
			/>
		</>
	);
}
