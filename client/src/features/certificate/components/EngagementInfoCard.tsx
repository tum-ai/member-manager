import { GlassCard } from "@/components/ui/GlassCard";
import type { EngagementCertificateRequest } from "@/hooks/useEngagementCertificateRequests";

interface Props {
	salutation: string;
	givenName: string;
	surname: string;
	birthDate: string;
	latestRequest?: EngagementCertificateRequest;
}

export function EngagementInfoCard({
	salutation,
	givenName,
	surname,
	birthDate,
	latestRequest,
}: Props): JSX.Element {
	return (
		<GlassCard className="mb-6">
			<div className="p-6">
				<p className="mb-4">
					Submit your engagement details for an admin review before the final
					certificate is released. Please enter{" "}
					<strong>accurate information</strong> for each period you were
					actively involved.
				</p>

				<p className="mb-4 text-sm text-muted-foreground">
					<strong>Important:</strong> Everything you enter below will be
					reviewed by an admin and appear in the final certificate only after
					approval. Make sure names, dates, and responsibilities are correct and
					complete.
				</p>

				{latestRequest && (
					<div className="mb-4 rounded-md bg-brand/10 p-4">
						<p className="mb-0.5 text-sm font-semibold">
							Current request status: {latestRequest.status}
						</p>
						{latestRequest.review_note && (
							<p className="text-sm text-muted-foreground">
								Admin note: {latestRequest.review_note}
							</p>
						)}
					</div>
				)}

				<div className="mb-4 rounded-md bg-muted p-4">
					<p className="text-sm">
						This is to confirm that{" "}
						<strong>
							{salutation} {givenName} {surname}
						</strong>
						{birthDate === "Not provided" ? "" : ", born on "}
						{birthDate === "Not provided" ? null : <strong>{birthDate}</strong>}
						, has voluntarily engaged with <strong>TUM.ai</strong>.
					</p>
				</div>
			</div>
		</GlassCard>
	);
}
