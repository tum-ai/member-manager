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
		setChecked(!!privacyAgreed); // Sync prop change
	}, [privacyAgreed]);

	useEffect(() => {
		onCheckChange?.(checked);
	}, [checked, onCheckChange]);

	return (
		<div>
			<div
				style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "1rem" }}
			>
				<h2>TUM.ai Privacy Policy / Data Agreement</h2>
				<p>
					This data agreement will explain why and how our organization uses
					personal data we collect from TUM.ai members. If you agree with our
					privacy policy, please sign the document at the bottom.
				</p>

				<h3>Location:</h3>
				<p>
					TUM.ai e.V.
					<br />
					Arcisstraße 21
					<br />
					80333 München
				</p>

				<h3>Contact:</h3>
				<p>
					The organization's data protection officer can be contacted by e-mail:
					<br />
					<a href="mailto:contact@tum-ai.com">contact@tum-ai.com</a>
				</p>

				<p>
					TUM.ai will notify you about any changes made to this privacy policy /
					data agreement 30 days before they become effective.
				</p>

				<h3>What is the legal basis for our data processing?</h3>
				<p>
					The legal basis for processing your data is your accession to TUM.ai.
					Our data processing is based on the DSGVO Art. 6 Abs. 1 S. 1 lit. b).
					Data processing in the sense of the DSGVO (Art. 4 S. 2) includes
					collection, storage, adaptation, consultation, use, disclosure,
					deletion, etc.
				</p>

				<h3>Why do we collect personal data?</h3>
				<ul>
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

				<h3>What data do we collect?</h3>
				<p>
					Required: Full name, course of studies, and email address (DSGVO Art.
					6 Abs. 1 lit. b)).
					<br />
					Optional: Profile photo, chat messages, survey replies, etc. (DSGVO
					Art. 6 Abs. 1 lit. a)).
				</p>

				<h3>How do we use your data?</h3>
				<p>
					We use your email to contact you and provide access to online tools
					(Slack, Notion). Your name, study course, and team details may be
					shown publicly with consent. Photos are optional and may also be
					published with consent. Internal accounting uses name and member
					number (Buchhaltungsbutler).
				</p>

				<h3>What services do we share your data with?</h3>
				<ul>
					<li>Mailchimp – for email communication</li>
					<li>Notion – for project and knowledge management</li>
					<li>Slack – for internal communication</li>
					<li>Website – for public profile (with consent)</li>
				</ul>

				<h3>How do we store your data?</h3>
				<p>
					Data entered or shared is stored via the above service providers, and
					subject to their terms and conditions.
				</p>

				<h3>How long do we store your data?</h3>
				<p>
					Your data is deleted as soon as the purpose ends, except fiscal data
					which is stored for 10 years in accordance with German law.
				</p>

				<h3>What are your data protection rights?</h3>
				<ul>
					<li>
						<strong>Access (Art. 15)</strong>: Request a copy of your personal
						data.
					</li>
					<li>
						<strong>Correction (Art. 16)</strong>: Correct incomplete or
						inaccurate data.
					</li>
					<li>
						<strong>Erasure (Art. 17)</strong>: Request deletion of your data
						under certain conditions.
					</li>
					<li>
						<strong>Restriction (Art. 18)</strong>: Limit processing of your
						data.
					</li>
					<li>
						<strong>Portability (Art. 20)</strong>: Transfer your data to
						another service or to you directly.
					</li>
					<li>
						<strong>Objection (Art. 21)</strong>: Object to processing under
						certain conditions.
					</li>
					<li>
						<strong>Complaint (Art. 77)</strong>: Lodge a complaint with a
						supervisory authority.
					</li>
				</ul>
				<p>
					TUM.ai must respond to requests within one month. Contact us at{" "}
					<a href="mailto:contact@tum-ai.com">contact@tum-ai.com</a>.
				</p>

				<h3>What happens if you do not agree?</h3>
				<p>
					If you do not sign the privacy policy, you cannot participate in
					TUM.ai's online tools which are essential for membership.
				</p>

				<h3>Written declaration of consent</h3>
				<p>
					I agree that the aforementioned data can be used by the association
					for association purposes and can be forwarded to other members of the
					association. I consent to processing of my personal data for the other
					aforementioned purposes, in accordance with DSGVO Art. 6 S. 1 lit. a).
					I am aware that consent with the data processing is voluntary and can
					be revoked by me at any time in whole or in part with effect for the
					future.
				</p>

				<div
					style={{
						marginTop: "2rem",
						paddingTop: "1rem",
						borderTop: "1px solid #e5e7eb",
					}}
				>
					<label>
						<input
							type="checkbox"
							checked={checked}
							onChange={(e) => setChecked(e.target.checked)}
							disabled={privacyAgreed}
						/>{" "}
						I have read and agree to the Privacy Policy.
					</label>
					{privacyAgreed && (
						<p
							style={{ fontSize: "0.9rem", color: "gray", marginTop: "0.5rem" }}
						>
							You have already agreed to the Privacy Policy.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
