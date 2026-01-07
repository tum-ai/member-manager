// Privacy Policy Agreement - MUI styled version
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

interface PrivacyPolicyProps {
	onCheckChange?: (checked: boolean) => void;
	privacyAgreed: boolean;
}

export default function PrivacyPolicy({
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
					TUM.ai Privacy Policy / Data Agreement
				</Typography>

				<Typography sx={{ mb: 3 }}>
					This data agreement will explain why and how our organization uses
					personal data we collect from TUM.ai members. If you agree with our
					privacy policy, please sign the document at the bottom.
				</Typography>

				<Section title="Location">
					<Typography>
						TUM.ai e.V.
						<br />
						Arcisstraße 21
						<br />
						80333 München
					</Typography>
				</Section>

				<Section title="Contact">
					<Typography>
						The organization's data protection officer can be contacted by
						e-mail:
						<br />
						<Link href="mailto:contact@tum-ai.com" color="primary">
							contact@tum-ai.com
						</Link>
					</Typography>
				</Section>

				<Typography sx={{ mb: 3 }}>
					TUM.ai will notify you about any changes made to this privacy policy /
					data agreement 30 days before they become effective.
				</Typography>

				<Section title="What is the legal basis for our data processing?">
					<Typography>
						The legal basis for processing your data is your accession to
						TUM.ai. Our data processing is based on the DSGVO Art. 6 Abs. 1 S. 1
						lit. b). Data processing in the sense of the DSGVO (Art. 4 S. 2)
						includes collection, storage, adaptation, consultation, use,
						disclosure, deletion, etc.
					</Typography>
				</Section>

				<Section title="Why do we collect personal data?">
					<List dense disablePadding>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="To connect and educate people interested in AI by sharing member info for easy exchange." />
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="To attract new members, sponsors, and partners—sponsors can send messages via TUM.ai without direct email access." />
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="To promote a vibrant community by publishing event photos (with consent per Art. 6 Abs. 1 S. 1 lit. a))." />
						</ListItem>
					</List>
				</Section>

				<Section title="What data do we collect?">
					<Typography>
						<strong>Required:</strong> Full name, course of studies, and email
						address (DSGVO Art. 6 Abs. 1 lit. b)).
						<br />
						<strong>Optional:</strong> Profile photo, chat messages, survey
						replies, etc. (DSGVO Art. 6 Abs. 1 lit. a)).
					</Typography>
				</Section>

				<Section title="How do we use your data?">
					<Typography>
						We use your email to contact you and provide access to online tools
						(Slack, Notion). Your name, study course, and team details may be
						shown publicly with consent. Photos are optional and may also be
						published with consent. Internal accounting uses name and member
						number (Buchhaltungsbutler).
					</Typography>
				</Section>

				<Section title="What services do we share your data with?">
					<List dense disablePadding>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="Mailchimp – for email communication" />
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="Notion – for project and knowledge management" />
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="Slack – for internal communication" />
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText primary="Website – for public profile (with consent)" />
						</ListItem>
					</List>
				</Section>

				<Section title="How do we store your data?">
					<Typography>
						Data entered or shared is stored via the above service providers,
						and subject to their terms and conditions.
					</Typography>
				</Section>

				<Section title="How long do we store your data?">
					<Typography>
						Your data is deleted as soon as the purpose ends, except fiscal data
						which is stored for 10 years in accordance with German law.
					</Typography>
				</Section>

				<Section title="What are your data protection rights?">
					<List dense disablePadding>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Access (Art. 15)"
								secondary="Request a copy of your personal data."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Correction (Art. 16)"
								secondary="Correct incomplete or inaccurate data."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Erasure (Art. 17)"
								secondary="Request deletion of your data under certain conditions."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Restriction (Art. 18)"
								secondary="Limit processing of your data."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Portability (Art. 20)"
								secondary="Transfer your data to another service or to you directly."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Objection (Art. 21)"
								secondary="Object to processing under certain conditions."
							/>
						</ListItem>
						<ListItem sx={{ pl: 0 }}>
							<ListItemText
								primary="Complaint (Art. 77)"
								secondary="Lodge a complaint with a supervisory authority."
							/>
						</ListItem>
					</List>
					<Typography sx={{ mt: 1 }}>
						TUM.ai must respond to requests within one month. Contact us at{" "}
						<Link href="mailto:contact@tum-ai.com" color="primary">
							contact@tum-ai.com
						</Link>
						.
					</Typography>
				</Section>

				<Section title="What happens if you do not agree?">
					<Typography>
						If you do not sign the privacy policy, you cannot participate in
						TUM.ai's online tools which are essential for membership.
					</Typography>
				</Section>

				<Section title="Written declaration of consent">
					<Typography>
						I agree that the aforementioned data can be used by the association
						for association purposes and can be forwarded to other members of
						the association. I consent to processing of my personal data for the
						other aforementioned purposes, in accordance with DSGVO Art. 6 S. 1
						lit. a). I am aware that consent with the data processing is
						voluntary and can be revoked by me at any time in whole or in part
						with effect for the future.
					</Typography>
				</Section>
			</Box>

			<Divider sx={{ my: 2 }} />

			<FormControlLabel
				control={
					<Checkbox
						checked={checked}
						onChange={(e) => setChecked(e.target.checked)}
					/>
				}
				label={
					<Typography variant="body2">
						I have read and agree to the Privacy Policy.
					</Typography>
				}
			/>
		</Box>
	);
}
