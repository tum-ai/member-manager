import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import { useSepaData } from "../../hooks/useSepaData";
import {
	type MemberSchema,
	type SepaSchema,
	memberSchema,
	sepaSchema,
} from "../../lib/schemas";
import type { PrivacyUpdateEventDetail, SepaUpdateEventDetail } from "../../types";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import SepaMandate from "../sepa/SepaMandate";

interface MemberFormProps {
	user: User;
}

export default function MemberForm({ user }: MemberFormProps) {
	const { showToast } = useToast();
	const [statusRequestMessage, setStatusRequestMessage] = useState("");
	const [showSepaModal, setShowSepaModal] = useState(false);
	const [showPrivacyModal, setShowPrivacyModal] = useState(false);

	// --- Custom Hooks ---
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

	// --- React Hook Form ---
	const memberForm = useForm<MemberSchema>({
		resolver: zodResolver(memberSchema),
		defaultValues: {
			active: true,
			salutation: "",
			title: "",
			surname: "",
			given_name: "",
			email: user.email || "",
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
			user_id: user.id,
		},
	});

	// Sync data when loaded
	useEffect(() => {
		if (memberData) {
			memberForm.reset({
				active: memberData.active,
				salutation: memberData.salutation || "",
				title: memberData.title || "",
				surname: memberData.surname || "",
				given_name: memberData.given_name || "",
				email: memberData.email || "",
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
		} catch (error: any) {
			showToast(`Error saving data: ${error.message}`, "error");
		}
	};

	// --- Event Listeners for Modals ---
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

		window.addEventListener("sepa-updated", handleSepaUpdate);
		window.addEventListener("privacy-updated", handlePrivacyUpdate);

		return () => {
			window.removeEventListener("sepa-updated", handleSepaUpdate);
			window.removeEventListener("privacy-updated", handlePrivacyUpdate);
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

	const isLoading = isLoadingMember || isLoadingSepa;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	if (isLoading)
		return <div className="text-white text-center p-8">Loading...</div>;

	const personalFields = [
		{ label: "Surname", name: "surname" as const },
		{ label: "Given Name", name: "given_name" as const },
		{ label: "Email", name: "email" as const, type: "email" },
		{ label: "Date of Birth", name: "date_of_birth" as const, type: "date" },
		{ label: "Street", name: "street" as const },
		{ label: "Number", name: "number" as const },
		{ label: "Postal Code", name: "postal_code" as const },
		{ label: "City", name: "city" as const },
		{ label: "Country", name: "country" as const },
	];

	return (
		<div className="p-8 max-w-3xl mx-auto text-white">
			<form onSubmit={memberForm.handleSubmit(onSubmit)}>
				<div className="flex flex-col md:flex-row gap-8">
					{/* Personal Data Column */}
					<div className="flex-1 min-w-[300px]">
						<h2 className="text-2xl font-bold mb-4">Personal Data</h2>

						{/* Salutation */}
						<label className="block mb-3">
							<span className="block mb-1">Salutation: *</span>
							<select
								{...memberForm.register("salutation")}
								className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
							>
								<option value="">-- Please choose --</option>
								<option value="Mr.">Mr.</option>
								<option value="Ms.">Ms.</option>
								<option value="Mx.">Mx.</option>
							</select>
							{memberForm.formState.errors.salutation && (
								<span className="text-red-400 text-sm">
									{memberForm.formState.errors.salutation.message}
								</span>
							)}
						</label>

						{/* Title */}
						<label className="block mb-3">
							<span className="block mb-1">Title:</span>
							<select
								{...memberForm.register("title")}
								className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
							>
								<option value="">-- Please choose --</option>
								<option value="Dr.">Dr.</option>
								<option value="Prof.">Prof.</option>
							</select>
						</label>

						{/* Active Status */}
						<div className="block mb-3 p-4 bg-gray-800 rounded border border-gray-700">
							<div className="mb-2">
								Active member:{" "}
								<strong>
									{memberForm.getValues("active") ? "Yes" : "No"}
								</strong>
							</div>
							<button
								type="button"
								onClick={handleStatusChangeRequest}
								className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
							>
								Request Status Change
							</button>
							{statusRequestMessage && (
								<p className="mt-2 text-green-400 text-sm">
									{statusRequestMessage}
								</p>
							)}
						</div>

						{/* Other Personal Fields */}
						{personalFields.map(({ label, name, type }) => (
							<label key={name} className="block mb-3">
								<span className="block mb-1">{label}: *</span>
								<input
									type={type || "text"}
									{...memberForm.register(name)}
									className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
								/>
								{memberForm.formState.errors[name] && (
									<span className="text-red-400 text-sm">
										{memberForm.formState.errors[name]?.message}
									</span>
								)}
							</label>
						))}
					</div>

					{/* Banking Details Column */}
					<div className="flex-1 min-w-[300px]">
						<h2 className="text-2xl font-bold mb-4">Banking Details</h2>

						<label className="block mb-3">
							<span className="block mb-1">IBAN: *</span>
							<input
								{...sepaForm.register("iban")}
								className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
							/>
							{sepaForm.formState.errors.iban && (
								<span className="text-red-400 text-sm">
									{sepaForm.formState.errors.iban.message}
								</span>
							)}
						</label>

						<label className="block mb-3">
							<span className="block mb-1">BIC:</span>
							<input
								{...sepaForm.register("bic")}
								className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
							/>
						</label>

						<label className="block mb-3">
							<span className="block mb-1">Bank Name: *</span>
							<input
								{...sepaForm.register("bank_name")}
								className="w-full p-2 rounded bg-gray-800 border border-gray-600 focus:border-blue-500 focus:outline-none"
							/>
							{sepaForm.formState.errors.bank_name && (
								<span className="text-red-400 text-sm">
									{sepaForm.formState.errors.bank_name.message}
								</span>
							)}
						</label>

						<div className="block mb-3">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									{...sepaForm.register("mandate_agreed")}
									className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
									onChange={(e) => {
										sepaForm.setValue("mandate_agreed", e.target.checked, {
											shouldDirty: true,
										});
										if (!sepaForm.getValues("mandate_agreed") && e.target.checked) {
											setShowSepaModal(true);
										}
									}}
								/>
								<span>
									I agree to the{" "}
									<button
										type="button"
										onClick={() => setShowSepaModal(true)}
										className="text-blue-400 hover:text-blue-300 underline"
									>
										SEPA mandate
									</button>
								</span>
							</label>
						</div>

						<div className="block mb-3">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									{...sepaForm.register("privacy_agreed")}
									className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
									disabled={sepaForm.getValues("privacy_agreed")}
									onChange={(e) => {
										sepaForm.setValue("privacy_agreed", e.target.checked, {
											shouldDirty: true,
										});
										if (
											!sepaForm.getValues("privacy_agreed") &&
											e.target.checked
										) {
											setShowPrivacyModal(true);
										}
									}}
								/>
								<span>
									I agree to the{" "}
									<button
										type="button"
										onClick={() => setShowPrivacyModal(true)}
										className="text-blue-400 hover:text-blue-300 underline"
									>
										Privacy Policy *
									</button>
								</span>
							</label>
						</div>

						<div className="mt-4">
							<small className="text-gray-400">* Required fields</small>
						</div>
					</div>
				</div>

				<div className="mt-8 flex gap-4">
					<button
						type="button"
						onClick={onSubmit}
						disabled={isUpdating}
						className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium transition-colors"
					>
						{isUpdating ? "Saving..." : "Save Data"}
					</button>
					<button
						type="button"
						onClick={() => {
							memberForm.reset();
							sepaForm.reset();
							showToast("Changes canceled.", "info");
						}}
						className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
					>
						Cancel
					</button>
				</div>
			</form>

			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					onConfirm={() => {
						sepaForm.setValue("mandate_agreed", true, { shouldDirty: true });
						window.dispatchEvent(
							new CustomEvent("sepa-updated", {
								detail: { mandate_agreed: true },
							}),
						);
						setShowSepaModal(false);
					}}
				>
					<SepaMandate
						sepaAgreed={sepaForm.getValues("mandate_agreed")}
						onCheckChange={(checked) =>
							sepaForm.setValue("mandate_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}

			{showPrivacyModal && (
				<Modal
					title="Privacy Policy Agreement"
					onClose={() => setShowPrivacyModal(false)}
					onConfirm={() => {
						sepaForm.setValue("privacy_agreed", true, { shouldDirty: true });
						window.dispatchEvent(
							new CustomEvent("privacy-updated", {
								detail: { privacy_agreed: true },
							}),
						);
						setShowPrivacyModal(false);
					}}
				>
					<PrivacyPolicy
						privacyAgreed={sepaForm.getValues("privacy_agreed")}
						onCheckChange={(checked) =>
							sepaForm.setValue("privacy_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}
		</div>
	);
}
