import { useFormContext } from "react-hook-form";
import { Modal } from "@/components/ui/Modal";
import { PrivacyPolicy } from "@/features/legal/PrivacyPolicy";
import type { ProfileFormValues } from "@/features/profile/profileFormModel";
import { SepaMandate } from "@/features/sepa/SepaMandate";

interface ProfileAgreementModalsProps {
	showSepaModal: boolean;
	setShowSepaModal: (value: boolean) => void;
	showPrivacyModal: boolean;
	setShowPrivacyModal: (value: boolean) => void;
	pendingMandateAgreed: boolean;
	setPendingMandateAgreed: (value: boolean) => void;
	pendingPrivacyAgreed: boolean;
	setPendingPrivacyAgreed: (value: boolean) => void;
}

export function ProfileAgreementModals({
	showSepaModal,
	setShowSepaModal,
	showPrivacyModal,
	setShowPrivacyModal,
	pendingMandateAgreed,
	setPendingMandateAgreed,
	pendingPrivacyAgreed,
	setPendingPrivacyAgreed,
}: ProfileAgreementModalsProps): JSX.Element {
	const form = useFormContext<ProfileFormValues>();
	return (
		<>
			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					confirmDisabled={!pendingMandateAgreed}
					onConfirm={() => {
						form.setValue("mandate_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowSepaModal(false);
					}}
				>
					<SepaMandate
						sepaAgreed={pendingMandateAgreed}
						onCheckChange={setPendingMandateAgreed}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={() => setShowPrivacyModal(false)}
					confirmDisabled={!pendingPrivacyAgreed}
					onConfirm={() => {
						form.setValue("privacy_agreed", true, {
							shouldDirty: true,
							shouldValidate: true,
						});
						setShowPrivacyModal(false);
					}}
				>
					<PrivacyPolicy
						privacyAgreed={pendingPrivacyAgreed}
						onCheckChange={setPendingPrivacyAgreed}
					/>
				</Modal>
			)}
		</>
	);
}
