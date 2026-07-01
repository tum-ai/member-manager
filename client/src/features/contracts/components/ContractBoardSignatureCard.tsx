import { GlassCard } from "@/components/ui/GlassCard";

interface ContractBoardSignatureCardProps {
	signerName: string | null;
	signatureData: string | null;
	signedAt: string | null;
}

/**
 * Read-only display of the board's signature, shown persistently once it
 * exists (independent of the current status). Previously the only place
 * showing the board signature was the signing form itself, which disappeared
 * the moment the status moved past "partner_signed" — making a recorded
 * board signature invisible in the contract view right after signing.
 */
export function ContractBoardSignatureCard({
	signerName,
	signatureData,
	signedAt,
}: ContractBoardSignatureCardProps): JSX.Element | null {
	if (!signatureData) return null;

	return (
		<GlassCard className="p-6">
			<p className="mb-2 text-base font-medium">Board signature</p>
			<div className="flex flex-col gap-2">
				<div className="text-sm">
					<span className="text-muted-foreground">Signed by </span>
					<span className="font-medium">{signerName || "Board"}</span>
					{signedAt ? (
						<span className="text-muted-foreground">
							{" "}
							on {new Date(signedAt).toLocaleString()}
						</span>
					) : null}
				</div>
				<img
					src={signatureData}
					alt={`Signature of ${signerName || "the board"}`}
					className="max-h-32 w-auto self-start rounded-md border bg-white p-2"
				/>
			</div>
		</GlassCard>
	);
}
