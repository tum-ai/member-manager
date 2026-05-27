import {
	Box,
	Checkbox,
	Divider,
	FormControlLabel,
	Link,
	List,
	ListItem,
	ListItemText,
	Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

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
		<Box sx={{ mb: 3 }}>
			<Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
				{title}
			</Typography>
			{children}
		</Box>
	);

	return (
		<Box>
			<Box sx={{ maxHeight: "55vh", overflowY: "auto", pr: 1 }}>
				<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
					Data Privacy Notice
				</Typography>

				<Section title="I. Preamble">
					<Typography sx={{ mb: 2 }}>
						The protection of your personal data and your privacy is important
						to us. We process your data for limited purposes only, in a
						confidential manner and only on the basis of and in accordance with
						applicable laws, in particular in accordance with the General Data
						Protection Regulation (GDPR) and the German Federal Data Protection
						Act (BDSG).
					</Typography>
					<Typography sx={{ mb: 2 }}>
						In this Data Privacy Notice we would like to inform you about the
						nature, scope and purposes of the collection and use of your
						personal data, and inform you about the legal basis of the
						processing, deletion periods, and about your respective rights.
					</Typography>
					<Typography sx={{ mb: 2 }}>
						The controller responsible for the processing of your data is:
					</Typography>
					<Typography sx={{ mb: 2 }}>
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 München
					</Typography>
					<Typography>
						TUM.ai will notify you about any changes made to this Data Privacy
						Notice thirty (30) days before they become effective.
					</Typography>
				</Section>

				<Section title="II. What Data Does TUM.ai Collect?">
					<Typography sx={{ mb: 1 }}>
						When you apply for a TUM.ai membership, TUM.ai collects and stores
						certain data about you. This includes the following data about you:
					</Typography>
					<List dense disablePadding>
						{[
							"Full name",
							"Email address",
							"Photo",
							"Curriculum vitae (CV)",
							"Course of studies",
						].map((item) => (
							<ListItem key={item} sx={{ pl: 0 }}>
								<ListItemText primary={item} />
							</ListItem>
						))}
					</List>
					<Typography sx={{ mt: 1 }}>
						In addition, TUM.ai stores data that you may actively and
						voluntarily provide in our online work and communication spaces
						(i.e., chat messages, replies to surveys, etc.).
					</Typography>
				</Section>

				<Section title="III. How Does TUM.ai Use Your Data?">
					<Typography sx={{ mb: 2 }}>
						TUM.ai uses your name and email address to contact you regarding
						matters involving your TUM.ai membership. The email address will
						also be used as your access credential to TUM.ai's online work and
						communication spaces. Further, your name and membership number will
						be used for managing membership fees and other financial ties
						between you and TUM.ai (if any).
					</Typography>
					<Typography sx={{ mb: 2 }}>
						If you provide your consent, TUM.ai will display your full name,
						photo, course of studies, TUM.ai internal position and team
						affiliation on its official website. TUM.ai notes that such
						information is globally accessible and further use by third parties
						cannot be excluded.
					</Typography>
					<Typography>
						In addition, TUM.ai may also take photos in the context of
						participation in public events of the association and publish them
						on the TUM.ai website as well as other public channels of TUM.ai
						such as on Instagram, Twitter, Facebook, presentations and press
						releases for public relations purposes.
					</Typography>
				</Section>

				<Section title="IV. What Is The Legal Basis For TUM.ai's Data Processing?">
					<Typography>
						The legal basis for processing your data for the purpose of the
						performing your TUM.ai membership is Article 6(1)(b) GDPR and for
						the purposes of managing your membership fees Article 6(1)(f) GDPR.
						To the extent you have given your consent for the publication of
						your data on the TUM.ai website and other public TUM.ai channels, we
						process your data on the basis of consent according to Article
						6(1)(a) GDPR.
					</Typography>
				</Section>

				<Section title="V. How Long Do We Store Your Data?">
					<Typography>
						TUM.ai will delete your data in accordance with applicable laws.
						This means that as soon as the purpose of the processing is no
						longer given, your data will be deleted unless there is a legal
						obligation to retain your data for a longer period of time.
						According to German law, data with fiscal relevance must be stored
						for ten years and will only be deleted after this period.
					</Typography>
				</Section>

				<Section title="VI. What Services Does TUM.ai Share Your Data With?">
					<Typography sx={{ mb: 2 }}>
						Subject to entering into the legally required agreements, TUM.ai
						shares your information with a limited number of communication
						service providers who process your data on TUM.ai's behalf to enable
						TUM.ai's work and communication platforms.
					</Typography>
					<List dense disablePadding>
						{[
							"Mailchimp for email traffic control",
							"Notion for knowledge storage, project management and node-tacking",
							"Slack for internal communication",
							"Buchhaltungsbutler for managing membership fees and financial aspects",
						].map((item) => (
							<ListItem key={item} sx={{ pl: 0 }}>
								<ListItemText primary={item} />
							</ListItem>
						))}
					</List>
					<Typography sx={{ mt: 1 }}>
						If you provide your consent, your information may also be shared
						with affiliated partners and other third parties for recruitment
						purposes and potential job opportunities, as well as workshops and
						events, both on-site and online. This includes but is not limited to
						TUM.ai providing your CV, photo, full name and email address.
					</Typography>
				</Section>

				<Section title="VII. Your Rights">
					<List dense disablePadding>
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
							<ListItem key={item} sx={{ pl: 0 }}>
								<ListItemText primary={item} />
							</ListItem>
						))}
					</List>
					<Typography sx={{ mt: 1 }}>
						If you wish to exercise your rights or have any questions regarding
						your rights, please contact our data protection officer at{" "}
						<Link href="mailto:legal@tum-ai.com" color="primary">
							legal@tum-ai.com
						</Link>
						.
					</Typography>
				</Section>

				<Divider sx={{ my: 3 }} />

				<Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
					Declaration of consent
				</Typography>
				<Typography sx={{ mb: 2 }}>I hereby declare my consent to</Typography>

				{consentItems.map((item) => (
					<FormControlLabel
						key={item.key}
						control={
							<Checkbox
								checked={checkedItems[item.key]}
								onChange={(event) =>
									setCheckedItems((currentValue) => ({
										...currentValue,
										[item.key]: event.target.checked,
									}))
								}
							/>
						}
						label={<Typography variant="body2">{item.label}</Typography>}
						sx={{
							alignItems: "flex-start",
							display: "flex",
							mb: 1.25,
							"& .MuiCheckbox-root": { pt: 0.25 },
						}}
					/>
				))}

				<Typography sx={{ mt: 2 }}>
					I have been informed that failure to give consent will not result in
					any adverse consequences and giving consent is, in particular, no
					requirement for my membership with TUM.ai. I may revoke my consent at
					any time by giving notice to TUM.ai for the future without affecting
					the lawfulness of the processing carried out until such revocation.
					TUM.ai has informed me that the processing may in certain
					circumstances also be lawful without my consent.
				</Typography>
			</Box>
		</Box>
	);
}
