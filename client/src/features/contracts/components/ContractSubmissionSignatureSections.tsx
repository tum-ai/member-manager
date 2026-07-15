import type { ContractSubmission } from "@member-manager/shared";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ContractSubmissionDetailViewModel } from "@/features/contracts/contractSubmissionDetailTypes";
import { SignaturePad } from "@/features/contracts/SignaturePad";
import { ContractBoardSignatureCard } from "./ContractBoardSignatureCard";
import { ContractCopyButton } from "./ContractCopyButton";
import { ContractPartnerSignatureCard } from "./ContractPartnerSignatureCard";

export function ContractSubmissionSignatureSections({
	submission,
	detail,
}: {
	submission: ContractSubmission;
	detail: ContractSubmissionDetailViewModel;
}): JSX.Element {
	return (
		<>
			{detail.isContractsAdmin && submission.signature_data ? (
				<ContractPartnerSignatureCard
					signerName={submission.signer_name}
					signatureData={submission.signature_data}
					signedAt={submission.signed_at}
				/>
			) : null}

			{/* Persistent, read-only once recorded — stays visible after the
			status moves past "partner_signed" so any contracts.admin (not
			just the board member who signed) can still see who signed. */}
			{detail.isContractsAdmin && submission.admin_signature_data ? (
				<ContractBoardSignatureCard
					signerName={submission.admin_signer_name}
					signatureData={submission.admin_signature_data}
					signedAt={submission.admin_signed_at}
				/>
			) : null}

			{detail.isContractsAdmin && submission.status === "partner_signed" ? (
				<GlassCard className="p-6">
					<p className="mb-2 text-base font-medium">Board signature</p>
					<div className="flex flex-col gap-4">
						{detail.isBoardMember ? (
							<>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="board-signer-name">Board signer name</Label>
									<Input
										id="board-signer-name"
										value={detail.boardSignerName}
										onChange={(event) =>
											detail.setBoardSignerName(event.target.value)
										}
										required
									/>
								</div>
								<SignaturePad onChange={detail.setBoardSignatureData} />
								<Button
									className="self-start"
									disabled={
										!detail.boardSignatureData ||
										!detail.boardSignerName.trim() ||
										detail.busy
									}
									onClick={detail.boardSign}
								>
									Board sign
								</Button>
								<Separator className="my-1" />
							</>
						) : (
							<p className="text-sm text-muted-foreground">
								Signing in-app requires board access. Generate a signing link
								below and share it with a board member instead.
							</p>
						)}

						{/* Board signing link, mirroring the partner link. */}
						<p className="text-sm text-muted-foreground">
							Or share a signing link so a board member can sign without logging
							in.
						</p>
						<Button
							variant="outline"
							className="self-start"
							disabled={detail.busy}
							onClick={detail.generateBoardSigningLink}
						>
							{detail.boardSignUrl
								? "Regenerate board signing link"
								: "Generate board signing link"}
						</Button>
						{detail.boardSignUrl ? (
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="board-sign-url">Board signing link</Label>
								<div className="flex items-center gap-1">
									<Input
										id="board-sign-url"
										value={detail.boardSignUrl}
										readOnly
									/>
									<ContractCopyButton value={detail.boardSignUrl} />
								</div>
							</div>
						) : null}
					</div>
				</GlassCard>
			) : null}

			{detail.isContractsAdmin &&
			(submission.status === "board_signed" ||
				submission.status === "completed") ? (
				<GlassCard className="p-6">
					<p className="mb-2 text-base font-medium">Final PDF</p>
					<Button
						className="self-start"
						disabled={detail.busy}
						onClick={detail.finalize}
					>
						{detail.finalPdfUrl
							? "Regenerate final PDF link"
							: "Generate final PDF link"}
					</Button>
				</GlassCard>
			) : null}
		</>
	);
}
