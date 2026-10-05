import type { MemberConsentsInput } from "@member-manager/shared";
import { ShieldCheck } from "lucide-react";
import { type ReactElement, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { Spinner } from "@/components/ui/spinner";
import {
	consentItems,
	DataPrivacyNotice,
} from "@/features/legal/DataPrivacyNotice";
import { PrivacyPolicy } from "@/features/legal/PrivacyPolicy";
import type { ConsentField } from "@/features/welcome/hooks/useWelcome";

const SAVE_BLOCKED_HINT =
	"Confirm that you've read the Privacy Policy and Data Privacy Notice to save.";

interface WelcomeConsentSectionProps {
	draft: MemberConsentsInput;
	onConsentChange: (field: ConsentField, value: boolean) => void;
	onAgreeToAll: () => void;
	onSave: () => void;
	isSaving: boolean;
	isDirty: boolean;
	isDecided: boolean;
}

type OpenDocument = "privacy-policy" | "data-privacy-notice" | null;

export function WelcomeConsentSection({
	draft,
	onConsentChange,
	onAgreeToAll,
	onSave,
	isSaving,
	isDirty,
	isDecided,
}: WelcomeConsentSectionProps): ReactElement {
	const [openDocument, setOpenDocument] = useState<OpenDocument>(null);
	const closeDocument = () => setOpenDocument(null);

	const allGranted =
		draft.privacy_policy_agreed &&
		consentItems.every((item) => draft[item.field]);
	// Reading the documents is required; the purposes below are optional.
	const isAcknowledged = draft.privacy_policy_agreed;
	const hintId = "welcome-consent-save-hint";

	// A link inside the checkbox card's <label> must open its document
	// without also toggling the checkbox.
	const documentLink = (
		document: Exclude<OpenDocument, null>,
		text: string,
	) => (
		<button
			type="button"
			className="text-brand underline underline-offset-2"
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				setOpenDocument(document);
			}}
		>
			{text}
		</button>
	);

	return (
		<GlassCard variant="elevated">
			<CardContent className="p-6">
				<div className="mb-1 flex items-center gap-2.5">
					<ShieldCheck aria-hidden="true" className="size-5 text-brand" />
					<h2 className="text-base font-semibold">Your consent</h2>
				</div>
				<p className="mb-4 text-sm text-muted-foreground">
					Optional consents can be updated anytime in your profile.
				</p>

				<div className="mb-5">
					<CheckboxCard
						checked={draft.privacy_policy_agreed}
						onCheckedChange={(value) =>
							onConsentChange("privacy_policy_agreed", value === true)
						}
						disabled={isSaving}
					>
						<span className="text-sm leading-relaxed">
							I have read and understood the TUM.ai{" "}
							{documentLink("privacy-policy", "Privacy Policy")} and{" "}
							{documentLink("data-privacy-notice", "Data Privacy Notice")}.
							<span className="ml-1 text-muted-foreground">(required)</span>
						</span>
					</CheckboxCard>
				</div>

				<fieldset className="mb-5 grid gap-3">
					<legend className="mb-2 text-sm font-medium">
						Optional consents
					</legend>
					{consentItems.map((item) => (
						<CheckboxCard
							key={item.field}
							checked={draft[item.field]}
							onCheckedChange={(value) =>
								onConsentChange(item.field, value === true)
							}
							disabled={isSaving}
						>
							<span className="text-sm leading-relaxed">{item.label}</span>
						</CheckboxCard>
					))}
				</fieldset>

				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<Button
						type="button"
						variant="outline"
						onClick={onAgreeToAll}
						disabled={isSaving || allGranted}
					>
						Agree to all
					</Button>
					<Button
						type="button"
						onClick={onSave}
						disabled={isSaving || !isAcknowledged || (isDecided && !isDirty)}
						aria-describedby={isAcknowledged ? undefined : hintId}
					>
						{isSaving && <Spinner className="size-4" />}
						{isDecided && !isDirty ? "Choices saved" : "Save my choices"}
					</Button>
				</div>
				{!isAcknowledged && (
					<p id={hintId} className="mt-2 text-xs text-muted-foreground">
						{SAVE_BLOCKED_HINT}
					</p>
				)}
			</CardContent>

			{/* Read-only full texts; the answers are collected above. */}
			<Dialog
				open={openDocument !== null}
				onOpenChange={(open) => {
					if (!open) closeDocument();
				}}
			>
				<DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
					<DialogHeader className="border-b px-6 py-4 text-left">
						<DialogTitle>
							{openDocument === "privacy-policy"
								? "Privacy Policy"
								: "Data Privacy Notice"}
						</DialogTitle>
						<DialogDescription className="sr-only">
							Full text of the document.
						</DialogDescription>
					</DialogHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
						{openDocument === "privacy-policy" ? (
							<PrivacyPolicy privacyAgreed={false} readOnly />
						) : (
							<DataPrivacyNotice dataPrivacyNoticeAgreed={false} readOnly />
						)}
					</div>
				</DialogContent>
			</Dialog>
		</GlassCard>
	);
}
