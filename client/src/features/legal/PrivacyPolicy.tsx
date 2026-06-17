// Privacy Policy Agreement - shadcn styled version
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface PrivacyPolicyProps {
	onCheckChange?: (checked: boolean) => void;
	privacyAgreed: boolean;
}

export function PrivacyPolicy({
	onCheckChange,
	privacyAgreed,
}: PrivacyPolicyProps) {
	const [checked, setChecked] = useState(!!privacyAgreed);

	useEffect(() => {
		setChecked(!!privacyAgreed);
	}, [privacyAgreed]);

	useEffect(() => {
		onCheckChange?.(checked);
	}, [checked, onCheckChange]);

	const Section = ({
		title,
		children,
	}: {
		title: string;
		children: React.ReactNode;
	}) => (
		<div className="mb-6">
			<h3 className="mb-2 font-semibold">{title}</h3>
			{children}
		</div>
	);

	return (
		<div>
			<div className="max-h-[55vh] overflow-y-auto pr-1">
				<h2 className="mb-4 text-lg font-semibold">
					TUM.ai Privacy Policy / Data Agreement
				</h2>

				<p className="mb-6">
					This data agreement will explain why and how our organization uses
					personal data we collect from TUM.ai members. If you agree with our
					privacy policy, please sign the document at the bottom.
				</p>

				<Section title="Location">
					<p>
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 München
					</p>
				</Section>

				<Section title="Contact">
					<p>
						The organization's data protection officer can be contacted by
						e-mail:
						<br />
						<a
							href="mailto:contact@tum-ai.com"
							className="text-brand underline"
						>
							contact@tum-ai.com
						</a>
					</p>
				</Section>

				<p className="mb-6">
					TUM.ai will notify you about any changes made to this privacy policy /
					data agreement 30 days before they become effective.
				</p>

				<Section title="What is the legal basis for our data processing?">
					<p>
						The legal basis for processing your data is your accession to
						TUM.ai. Our data processing is based on the DSGVO Art. 6 Abs. 1 S. 1
						lit. b). Data processing in the sense of the DSGVO (Art. 4 S. 2)
						includes collection, storage, adaptation, consultation, use,
						disclosure, deletion, etc.
					</p>
				</Section>

				<Section title="Why do we collect personal data?">
					<ul className="list-disc space-y-1 pl-5">
						<li>
							To connect and educate people interested in AI by sharing member
							info for easy exchange.
						</li>
						<li>
							To attract new members, sponsors, and partners—sponsors can send
							messages via TUM.ai without direct email access.
						</li>
						<li>
							To promote a vibrant community by publishing event photos (with
							consent per Art. 6 Abs. 1 S. 1 lit. a)).
						</li>
					</ul>
				</Section>

				<Section title="What data do we collect?">
					<p>
						<strong>Required:</strong> Full name, course of studies, and email
						address (DSGVO Art. 6 Abs. 1 lit. b)).
						<br />
						<strong>Optional:</strong> Profile photo, chat messages, survey
						replies, etc. (DSGVO Art. 6 Abs. 1 lit. a)).
					</p>
				</Section>

				<Section title="How do we use your data?">
					<p>
						We use your email to contact you and provide access to online tools
						(Slack, Notion). Your name, study course, and team details may be
						shown publicly with consent. Photos are optional and may also be
						published with consent. Internal accounting uses name and member
						number (Buchhaltungsbutler).
					</p>
				</Section>

				<Section title="What services do we share your data with?">
					<ul className="list-disc space-y-1 pl-5">
						<li>Mailchimp – for email communication</li>
						<li>Notion – for project and knowledge management</li>
						<li>Slack – for internal communication</li>
						<li>Website – for public profile (with consent)</li>
					</ul>
				</Section>

				<Section title="How do we store your data?">
					<p>
						Data entered or shared is stored via the above service providers,
						and subject to their terms and conditions.
					</p>
				</Section>

				<Section title="How long do we store your data?">
					<p>
						Your data is deleted as soon as the purpose ends, except fiscal data
						which is stored for 10 years in accordance with German law.
					</p>
				</Section>

				<Section title="What are your data protection rights?">
					<ul className="list-disc space-y-1 pl-5">
						<li>
							<strong>Access (Art. 15)</strong> — Request a copy of your
							personal data.
						</li>
						<li>
							<strong>Correction (Art. 16)</strong> — Correct incomplete or
							inaccurate data.
						</li>
						<li>
							<strong>Erasure (Art. 17)</strong> — Request deletion of your data
							under certain conditions.
						</li>
						<li>
							<strong>Restriction (Art. 18)</strong> — Limit processing of your
							data.
						</li>
						<li>
							<strong>Portability (Art. 20)</strong> — Transfer your data to
							another service or to you directly.
						</li>
						<li>
							<strong>Objection (Art. 21)</strong> — Object to processing under
							certain conditions.
						</li>
						<li>
							<strong>Complaint (Art. 77)</strong> — Lodge a complaint with a
							supervisory authority.
						</li>
					</ul>
					<p className="mt-2">
						TUM.ai must respond to requests within one month. Contact us at{" "}
						<a
							href="mailto:contact@tum-ai.com"
							className="text-brand underline"
						>
							contact@tum-ai.com
						</a>
						.
					</p>
				</Section>

				<Section title="What happens if you do not agree?">
					<p>
						If you do not sign the privacy policy, you cannot participate in
						TUM.ai's online tools which are essential for membership.
					</p>
				</Section>

				<Section title="Written declaration of consent">
					<p>
						I agree that the aforementioned data can be used by the association
						for association purposes and can be forwarded to other members of
						the association. I consent to processing of my personal data for the
						other aforementioned purposes, in accordance with DSGVO Art. 6 S. 1
						lit. a). I am aware that consent with the data processing is
						voluntary and can be revoked by me at any time in whole or in part
						with effect for the future.
					</p>
				</Section>
			</div>

			<Separator className="my-4" />

			<div className="flex items-center gap-2">
				<Checkbox
					id="privacy-agree"
					checked={checked}
					onCheckedChange={(value) => setChecked(value === true)}
				/>
				<Label htmlFor="privacy-agree" className="text-sm font-normal">
					I have read and agree to the Privacy Policy.
				</Label>
			</div>
		</div>
	);
}
