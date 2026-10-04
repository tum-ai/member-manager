import type { MemberConsents } from "@member-manager/shared";
import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { consentItems } from "@/features/legal/DataPrivacyNotice";

const SHORT_LABELS: Record<(typeof consentItems)[number]["field"], string> = {
	website_profile_consent: "Profile on the TUM.ai website",
	event_photos_consent: "Event photos in public channels",
	partner_sharing_consent: "Sharing my data and CV with partners",
};

interface DataPrivacyConsentSummaryProps {
	consents: MemberConsents | undefined;
}

/**
 * Read-only view of the member's Data Privacy Notice consents. They're edited
 * per purpose on /welcome; the profile deliberately offers no combined
 * checkbox, which can't express a partial choice.
 */
export function DataPrivacyConsentSummary({
	consents,
}: DataPrivacyConsentSummaryProps): ReactElement {
	const isDecided = Boolean(consents?.consents_decided_at);

	return (
		<section aria-labelledby="data-privacy-consents-heading">
			<h3
				id="data-privacy-consents-heading"
				className="mb-2 text-sm font-medium"
			>
				Data Privacy Notice consents
			</h3>
			{isDecided && consents ? (
				<dl className="mb-3 grid gap-1 text-sm">
					{consentItems.map((item) => (
						<div key={item.field} className="flex justify-between gap-4">
							<dt className="text-muted-foreground">
								{SHORT_LABELS[item.field]}
							</dt>
							<dd className="shrink-0 font-medium">
								{consents[item.field] ? "Agreed" : "Not agreed"}
							</dd>
						</div>
					))}
				</dl>
			) : (
				<p className="mb-3 text-sm text-muted-foreground">
					You haven't made your choices yet.
				</p>
			)}
			<Link
				to="/welcome"
				className="text-sm text-brand underline underline-offset-2"
			>
				{isDecided ? "Manage consents" : "Make your choices"}
			</Link>
		</section>
	);
}
