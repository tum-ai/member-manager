import { useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { ProfileFormValues } from "@/features/profile/profileFormModel";

/**
 * Open/confirm state of the SEPA mandate and privacy policy dialogs. The
 * checkbox inside a dialog is staged (`pending*`) and only written to the form
 * when the member confirms.
 */
export function useAgreementModals(form: UseFormReturn<ProfileFormValues>) {
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [pendingMandateAgreed, setPendingMandateAgreed] = useState(false);
	const [pendingPrivacyAgreed, setPendingPrivacyAgreed] = useState(false);

	const mandateAgreed = useWatch({
		control: form.control,
		name: "mandate_agreed",
	});
	const privacyAgreed = useWatch({
		control: form.control,
		name: "privacy_agreed",
	});

	return {
		mandateAgreed,
		privacyAgreed,
		openSepaModal: () => {
			setPendingMandateAgreed(mandateAgreed);
			setShowSepaModal(true);
		},
		openPrivacyModal: () => {
			setPendingPrivacyAgreed(privacyAgreed);
			setShowPrivacyModal(true);
		},
		modalProps: {
			showSepaModal,
			setShowSepaModal,
			showPrivacyModal,
			setShowPrivacyModal,
			pendingMandateAgreed,
			setPendingMandateAgreed,
			pendingPrivacyAgreed,
			setPendingPrivacyAgreed,
		},
	};
}
