import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/contexts/ToastContext";
import { useMemberData } from "@/hooks/useMemberData";
import { useSepaData } from "@/hooks/useSepaData";
import {
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "@/lib/schemas";
import type {
	DataPrivacyNoticeUpdateEventDetail,
	PrivacyUpdateEventDetail,
	SepaUpdateEventDetail,
} from "@/types";

export function useMemberForm(user: User) {
	const { showToast } = useToast();
	const [statusRequestMessage, setStatusRequestMessage] = useState("");
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);
	const [showDataPrivacyNoticeModal, setShowDataPrivacyNoticeModal] =
		useState(false);

	const {
		member: memberData,
		isLoading: isLoadingMember,
		updateMemberAsync,
		isUpdating: isUpdatingMember,
	} = useMemberData(user.id);

	const {
		sepa: sepaData,
		isLoading: isLoadingSepa,
		updateSepaAsync,
		isUpdating: isUpdatingSepa,
	} = useSepaData(user.id);

	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			date_of_birth: "",
			street: "",
			number: "",
			postal_code: "",
			city: "",
			country: "",
			user_id: user.id,
		},
	});

	const sepaForm = useForm<SepaSchema>({
		resolver: zodResolver(sepaSchema),
		defaultValues: {
			iban: "",
			bic: "",
			bank_name: "",
			mandate_agreed: false,
			privacy_agreed: false,
			data_privacy_notice_agreed: false,
			user_id: user.id,
		},
	});

	const mandateAgreed = sepaForm.watch("mandate_agreed");
	const privacyAgreed = sepaForm.watch("privacy_agreed");
	const dataPrivacyNoticeAgreed = sepaForm.watch("data_privacy_notice_agreed");

	useEffect(() => {
		if (memberData) {
			memberForm.reset({
				active: memberData.active,
				salutation: memberData.salutation || "",
				title: memberData.title || "",
				surname: memberData.surname || "",
				given_name: memberData.given_name || "",
				date_of_birth: memberData.date_of_birth || "",
				street: memberData.street || "",
				number: memberData.number || "",
				postal_code: memberData.postal_code || "",
				city: memberData.city || "",
				country: memberData.country || "",
				user_id: user.id,
			});
		}
	}, [memberData, memberForm, user.id]);

	useEffect(() => {
		if (sepaData) {
			sepaForm.reset({
				iban: sepaData.iban || "",
				bic: sepaData.bic || "",
				bank_name: sepaData.bank_name || "",
				mandate_agreed: sepaData.mandate_agreed || false,
				privacy_agreed: sepaData.privacy_agreed || false,
				data_privacy_notice_agreed:
					sepaData.data_privacy_notice_agreed || false,
				user_id: user.id,
			});
		}
	}, [sepaData, sepaForm, user.id]);

	const onSubmit = async () => {
		try {
			const memberValid = await memberForm.trigger();
			const sepaValid = await sepaForm.trigger();

			const promises = [];
			if (memberValid) {
				promises.push(updateMemberAsync(memberForm.getValues()));
			}
			if (sepaValid) {
				promises.push(updateSepaAsync(sepaForm.getValues()));
			}

			await Promise.all(promises);
			showToast("Data saved successfully!", "success");
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			showToast(`Error saving data: ${errorMessage}`, "error");
		}
	};

	useEffect(() => {
		const handleSepaUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<SepaUpdateEventDetail>;
			if (
				customEvent.detail &&
				typeof customEvent.detail.mandate_agreed === "boolean"
			) {
				sepaForm.setValue("mandate_agreed", customEvent.detail.mandate_agreed, {
					shouldDirty: true,
				});
			}
		};

		const handlePrivacyUpdate = (event: Event) => {
			const customEvent = event as CustomEvent<PrivacyUpdateEventDetail>;
			if (
				customEvent.detail &&
				typeof customEvent.detail.privacy_agreed === "boolean"
			) {
				sepaForm.setValue("privacy_agreed", customEvent.detail.privacy_agreed, {
					shouldDirty: true,
				});
			}
		};

		const handleDataPrivacyNoticeUpdate = (event: Event) => {
			const customEvent =
				event as CustomEvent<DataPrivacyNoticeUpdateEventDetail>;
			if (
				customEvent.detail &&
				typeof customEvent.detail.data_privacy_notice_agreed === "boolean"
			) {
				sepaForm.setValue(
					"data_privacy_notice_agreed",
					customEvent.detail.data_privacy_notice_agreed,
					{
						shouldDirty: true,
					},
				);
			}
		};

		window.addEventListener("sepa-updated", handleSepaUpdate);
		window.addEventListener("privacy-updated", handlePrivacyUpdate);
		window.addEventListener(
			"data-privacy-notice-updated",
			handleDataPrivacyNoticeUpdate,
		);

		return () => {
			window.removeEventListener("sepa-updated", handleSepaUpdate);
			window.removeEventListener("privacy-updated", handlePrivacyUpdate);
			window.removeEventListener(
				"data-privacy-notice-updated",
				handleDataPrivacyNoticeUpdate,
			);
		};
	}, [sepaForm]);

	function handleStatusChangeRequest() {
		const requestedStatus = memberForm.getValues("active")
			? "inactive"
			: "active";
		const confirmed = window.confirm(
			`Are you sure you want to request a status change to ${requestedStatus}?\n\nThis will be a legally binding request and will be sent to finance@tum-ai.com.`,
		);
		if (confirmed) {
			setStatusRequestMessage(
				`A request to change your membership status to "${requestedStatus}" has been sent to finance@tum-ai.com. You will receive a confirmation email once the request is processed.`,
			);
			showToast("Status change request sent!", "info");
		}
	}

	function handleCancel() {
		memberForm.reset();
		sepaForm.reset();
		showToast("Changes reverted to last saved state.", "info");
	}

	const isLoading = isLoadingMember || isLoadingSepa;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	return {
		memberForm,
		sepaForm,
		memberData,
		email: memberData?.email || user.email || "",
		statusRequestMessage,
		showSepaModal,
		setShowSepaModal,
		showPrivacyModal,
		setShowPrivacyModal,
		showDataPrivacyNoticeModal,
		setShowDataPrivacyNoticeModal,
		mandateAgreed,
		privacyAgreed,
		dataPrivacyNoticeAgreed,
		isLoading,
		isUpdating,
		onSubmit,
		handleStatusChangeRequest,
		handleCancel,
	};
}
