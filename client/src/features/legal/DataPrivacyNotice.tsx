import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ConsentKey = "websiteProfile" | "eventPhotos" | "partnerSharing";

interface DataPrivacyNoticeProps {
	dataPrivacyNoticeAgreed: boolean;
	onCheckChange?: (checked: boolean) => void;
}

const consentItems: Array<{
	key: ConsentKey;
	label: string;
}> = [
	{
		key: "websiteProfile",
		label:
			"TUM.ai displaying my full name, photo, course of studies, TUM.ai internal position and team affiliation on its official website.",
	},
	{
		key: "eventPhotos",
		label:
			"TUM.ai publishing photos of me taken in the context of participation in public events of the association on the TUM.ai website as well as other public TUM.ai channels such as on Instagram, Twitter, Facebook, presentations and press releases for public relations purposes.",
	},
	{
		key: "partnerSharing",
		label:
			"TUM.ai sharing my data (including CV, photo, full name and email address) with affiliated partners and other third parties for recruitment purposes and potential job opportunities, as well as workshops and events, both on-site and online.",
	},
];

function getInitialConsentState(agreed: boolean): Record<ConsentKey, boolean> {
	return {
		websiteProfile: agreed,
		eventPhotos: agreed,
		partnerSharing: agreed,
	};
}

export default function DataPrivacyNotice({
	dataPrivacyNoticeAgreed,
	onCheckChange,
}: DataPrivacyNoticeProps) {
	const [checkedItems, setCheckedItems] = useState<Record<ConsentKey, boolean>>(
		() => getInitialConsentState(dataPrivacyNoticeAgreed),
	);

	const allChecked = consentItems.every((item) => checkedItems[item.key]);

	useEffect(() => {
		onCheckChange?.(allChecked);
	}, [allChecked, onCheckChange]);

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
				<h2 className="mb-4 text-lg font-semibold">Data Privacy Notice</h2>

				<Section title="I. Preamble">
					<p className="mb-4">
						The protection of your personal data and your privacy is important
						to us. We process your data for limited purposes only, in a
						confidential manner and only on the basis of and in accordance with
						applicable laws, in particular in accordance with the General Data
						Protection Regulation (GDPR) and the German Federal Data Protection
						Act (BDSG).
					</p>
					<p className="mb-4">
						In this Data Privacy Notice we would like to inform you about the
						nature, scope and purposes of the collection and use of your
						personal data, and inform you about the legal basis of the
						processing, deletion periods, and about your respective rights.
					</p>
					<p className="mb-4">
						The controller responsible for the processing of your data is:
					</p>
					<p className="mb-4">
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 München
					</p>
					<p>
						TUM.ai will notify you about any changes made to this Data Privacy
						Notice thirty (30) days before they become effective.
					</p>
				</Section>

				<Section title="II. What Data Does TUM.ai Collect?">
					<p className="mb-2">
						When you apply for a TUM.ai membership, TUM.ai collects and stores
						certain data about you. This includes the following data about you:
					</p>
					<ul className="list-disc space-y-1 pl-5">
						{[
							"Full name",
							"Email address",
							"Photo",
							"Curriculum vitae (CV)",
							"Course of studies",
						].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<p className="mt-2">
						In addition, TUM.ai stores data that you may actively and
						voluntarily provide in our online work and communication spaces
						(i.e., chat messages, replies to surveys, etc.).
					</p>
				</Section>

				<Section title="III. How Does TUM.ai Use Your Data?">
					<p className="mb-4">
						TUM.ai uses your name and email address to contact you regarding
						matters involving your TUM.ai membership. The email address will
						also be used as your access credential to TUM.ai's online work and
						communication spaces. Further, your name and membership number will
						be used for managing membership fees and other financial ties
						between you and TUM.ai (if any).
					</p>
					<p className="mb-4">
						If you provide your consent, TUM.ai will display your full name,
						photo, course of studies, TUM.ai internal position and team
						affiliation on its official website. TUM.ai notes that such
						information is globally accessible and further use by third parties
						cannot be excluded.
					</p>
					<p>
						In addition, TUM.ai may also take photos in the context of
						participation in public events of the association and publish them
						on the TUM.ai website as well as other public channels of TUM.ai
						such as on Instagram, Twitter, Facebook, presentations and press
						releases for public relations purposes.
					</p>
				</Section>

				<Section title="IV. What Is The Legal Basis For TUM.ai's Data Processing?">
					<p>
						The legal basis for processing your data for the purpose of the
						performing your TUM.ai membership is Article 6(1)(b) GDPR and for
						the purposes of managing your membership fees Article 6(1)(f) GDPR.
						To the extent you have given your consent for the publication of
						your data on the TUM.ai website and other public TUM.ai channels, we
						process your data on the basis of consent according to Article
						6(1)(a) GDPR.
					</p>
				</Section>

				<Section title="V. How Long Do We Store Your Data?">
					<p>
						TUM.ai will delete your data in accordance with applicable laws.
						This means that as soon as the purpose of the processing is no
						longer given, your data will be deleted unless there is a legal
						obligation to retain your data for a longer period of time.
						According to German law, data with fiscal relevance must be stored
						for ten years and will only be deleted after this period.
					</p>
				</Section>

				<Section title="VI. What Services Does TUM.ai Share Your Data With?">
					<p className="mb-4">
						Subject to entering into the legally required agreements, TUM.ai
						shares your information with a limited number of communication
						service providers who process your data on TUM.ai's behalf to enable
						TUM.ai's work and communication platforms.
					</p>
					<ul className="list-disc space-y-1 pl-5">
						{[
							"Mailchimp for email traffic control",
							"Notion for knowledge storage, project management and node-tacking",
							"Slack for internal communication",
							"Buchhaltungsbutler for managing membership fees and financial aspects",
						].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<p className="mt-2">
						If you provide your consent, your information may also be shared
						with affiliated partners and other third parties for recruitment
						purposes and potential job opportunities, as well as workshops and
						events, both on-site and online. This includes but is not limited to
						TUM.ai providing your CV, photo, full name and email address.
					</p>
				</Section>

				<Section title="VII. Your Rights">
					<ul className="list-disc space-y-1 pl-5">
						{[
							"Right to access your data (Article 15 GDPR)",
							"Right to rectification (Article 16 GDPR)",
							"Right to deletion (Article 17 GDPR)",
							"Right to restrict the data processing (Article 18 GDPR)",
							"Right to data portability (Article 20 GDPR)",
							"Right to object against data processing (Article 21 GDPR)",
							"Right to revoke a declaration of consent under data protection law (Article 7 GDPR)",
							"Right to lodge a complaint with a supervisory authority (Article 77 GDPR)",
						].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<p className="mt-2">
						If you wish to exercise your rights or have any questions regarding
						your rights, please contact our data protection officer at{" "}
						<a href="mailto:legal@tum-ai.com" className="text-brand underline">
							legal@tum-ai.com
						</a>
						.
					</p>
				</Section>

				<Separator className="my-6" />

				<h3 className="mb-2 font-semibold">Declaration of consent</h3>
				<p className="mb-4">I hereby declare my consent to</p>

				{consentItems.map((item) => (
					<div key={item.key} className="mb-3 flex items-start gap-2">
						<Checkbox
							id={`consent-${item.key}`}
							className="mt-0.5"
							checked={checkedItems[item.key]}
							onCheckedChange={(value) =>
								setCheckedItems((currentValue) => ({
									...currentValue,
									[item.key]: value === true,
								}))
							}
						/>
						<Label
							htmlFor={`consent-${item.key}`}
							className="text-sm font-normal leading-relaxed"
						>
							{item.label}
						</Label>
					</div>
				))}

				<p className="mt-4">
					I have been informed that failure to give consent will not result in
					any adverse consequences and giving consent is, in particular, no
					requirement for my membership with TUM.ai. I may revoke my consent at
					any time by giving notice to TUM.ai for the future without affecting
					the lawfulness of the processing carried out until such revocation.
					TUM.ai has informed me that the processing may in certain
					circumstances also be lawful without my consent.
				</p>
			</div>
		</div>
	);
}
