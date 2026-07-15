import { GlassCard } from "@/components/ui/GlassCard";

interface ContractPartnerSignatureCardProps {
	signerName: string | null;
	signatureData: string | null;
	signedAt: string | null;
}

/**
 * Read-only display of the partner's signature in the contract view (shown
 * above the board signature block). Purely informational — there is no way to
 * edit or sign on the partner's behalf here.
 */
export function ContractPartnerSignatureCard({
	signerName,
	signatureData,
	signedAt,
}: ContractPartnerSignatureCardProps): JSX.Element | null {
	if (!signatureData) return null;

	return (
		<GlassCard className="p-6">
			<p className="mb-2 text-base font-medium">Partner signature</p>
			<div className="flex flex-col gap-2">
				<div className="text-sm">
					<span className="text-muted-foreground">Signed by </span>
					<span className="font-medium">{signerName || "Partner"}</span>
					{signedAt ? (
						<span className="text-muted-foreground">
							{" "}
							on {new Date(signedAt).toLocaleString()}
						</span>
					) : null}
				</div>
				<img
					src={signatureData}
					alt={`Signature of ${signerName || "the partner"}`}
					className="max-h-32 w-auto self-start rounded-md border bg-white p-2"
				/>
			</div>
		</GlassCard>
	);
}
