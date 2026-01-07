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
		<div className="flex justify-center items-start min-h-[calc(100vh-100px)] p-4 sm:p-8">
			<div className="w-full max-w-5xl bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-700">
				<form onSubmit={memberForm.handleSubmit(onSubmit)} className="flex flex-col lg:flex-row">
					
					{/* Left Column: Personal Data */}
					<div className="flex-1 p-6 sm:p-8 lg:border-r border-gray-700">
						<div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
							<h2 className="text-xl font-semibold text-white">Personal Information</h2>
							<div className={`px-3 py-1 rounded-full text-xs font-medium border ${memberForm.getValues("active") ? "bg-green-900/30 text-green-400 border-green-800" : "bg-red-900/30 text-red-400 border-red-800"}`}>
								{memberForm.getValues("active") ? "Active Member" : "Inactive"}
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
							{/* Salutation & Title */}
							<div className="sm:col-span-4">
								<label className="block text-sm font-medium text-gray-400 mb-1">Salutation *</label>
								<select
									{...memberForm.register("salutation")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								>
									<option value="">Select...</option>
									<option value="Mr.">Mr.</option>
									<option value="Ms.">Ms.</option>
									<option value="Mx.">Mx.</option>
								</select>
								{memberForm.formState.errors.salutation && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.salutation.message}</span>
								)}
							</div>
							<div className="sm:col-span-8">
								<label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
								<select
									{...memberForm.register("title")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								>
									<option value="">None</option>
									<option value="Dr.">Dr.</option>
									<option value="Prof.">Prof.</option>
								</select>
							</div>

							{/* Names */}
							<div className="sm:col-span-6">
								<label className="block text-sm font-medium text-gray-400 mb-1">First Name *</label>
								<input
									{...memberForm.register("given_name")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
									placeholder="John"
								/>
								{memberForm.formState.errors.given_name && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.given_name.message}</span>
								)}
							</div>
							<div className="sm:col-span-6">
								<label className="block text-sm font-medium text-gray-400 mb-1">Last Name *</label>
								<input
									{...memberForm.register("surname")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
									placeholder="Doe"
								/>
								{memberForm.formState.errors.surname && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.surname.message}</span>
								)}
							</div>

							{/* Contact */}
							<div className="sm:col-span-8">
								<label className="block text-sm font-medium text-gray-400 mb-1">Email *</label>
								<input
									type="email"
									{...memberForm.register("email")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.email && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.email.message}</span>
								)}
							</div>
							<div className="sm:col-span-4">
								<label className="block text-sm font-medium text-gray-400 mb-1">Date of Birth *</label>
								<input
									type="date"
									{...memberForm.register("date_of_birth")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.date_of_birth && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.date_of_birth.message}</span>
								)}
							</div>

							{/* Address */}
							<div className="sm:col-span-9">
								<label className="block text-sm font-medium text-gray-400 mb-1">Street *</label>
								<input
									{...memberForm.register("street")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.street && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.street.message}</span>
								)}
							</div>
							<div className="sm:col-span-3">
								<label className="block text-sm font-medium text-gray-400 mb-1">No. *</label>
								<input
									{...memberForm.register("number")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.number && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.number.message}</span>
								)}
							</div>

							<div className="sm:col-span-4">
								<label className="block text-sm font-medium text-gray-400 mb-1">Postal Code *</label>
								<input
									{...memberForm.register("postal_code")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.postal_code && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.postal_code.message}</span>
								)}
							</div>
							<div className="sm:col-span-8">
								<label className="block text-sm font-medium text-gray-400 mb-1">City *</label>
								<input
									{...memberForm.register("city")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
								/>
								{memberForm.formState.errors.city && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.city.message}</span>
								)}
							</div>
							<div className="sm:col-span-12">
								<label className="block text-sm font-medium text-gray-400 mb-1">Country *</label>
								<input
									{...memberForm.register("country")}
									className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
									defaultValue="Germany"
								/>
								{memberForm.formState.errors.country && (
									<span className="text-red-400 text-xs mt-1 block">{memberForm.formState.errors.country.message}</span>
								)}
							</div>
						</div>

						{/* Status Change Request */}
						<div className="mt-8 pt-6 border-t border-gray-700">
							<button
								type="button"
								onClick={handleStatusChangeRequest}
								className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors flex items-center gap-1"
							>
								Need to change your membership status?
							</button>
							{statusRequestMessage && (
								<div className="mt-3 p-3 bg-blue-900/20 border border-blue-800 rounded text-sm text-blue-200">
									{statusRequestMessage}
								</div>
							)}
						</div>
					</div>

					{/* Right Column: Banking Details & Actions */}
					<div className="lg:w-96 bg-gray-800/50 p-6 sm:p-8 flex flex-col justify-between">
						<div>
							<h2 className="text-xl font-semibold text-white mb-6 pb-4 border-b border-gray-700">Banking Details</h2>
							
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-400 mb-1">IBAN *</label>
									<input
										{...sepaForm.register("iban")}
										className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm font-mono"
										placeholder="DE..."
									/>
									{sepaForm.formState.errors.iban && (
										<span className="text-red-400 text-xs mt-1 block">{sepaForm.formState.errors.iban.message}</span>
									)}
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-400 mb-1">BIC</label>
									<input
										{...sepaForm.register("bic")}
										className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm font-mono"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-400 mb-1">Bank Name *</label>
									<input
										{...sepaForm.register("bank_name")}
										className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-white text-sm"
									/>
									{sepaForm.formState.errors.bank_name && (
										<span className="text-red-400 text-xs mt-1 block">{sepaForm.formState.errors.bank_name.message}</span>
									)}
								</div>

								<div className="pt-4 space-y-3">
									<label className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 bg-gray-900/30 hover:bg-gray-900/50 transition-colors cursor-pointer group">
										<input
											type="checkbox"
											{...sepaForm.register("mandate_agreed")}
											className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
											onChange={(e) => {
												sepaForm.setValue("mandate_agreed", e.target.checked, {
													shouldDirty: true,
												});
												if (!sepaForm.getValues("mandate_agreed") && e.target.checked) {
													setShowSepaModal(true);
												}
											}}
										/>
										<span className="text-sm text-gray-300">
											I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowSepaModal(true); }} className="text-blue-400 hover:underline font-medium">SEPA mandate</button>
										</span>
									</label>

									<label className="flex items-start gap-3 p-3 rounded-lg border border-gray-700 bg-gray-900/30 hover:bg-gray-900/50 transition-colors cursor-pointer group">
										<input
											type="checkbox"
											{...sepaForm.register("privacy_agreed")}
											className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
											disabled={sepaForm.getValues("privacy_agreed")}
											onChange={(e) => {
												sepaForm.setValue("privacy_agreed", e.target.checked, {
													shouldDirty: true,
												});
												if (!sepaForm.getValues("privacy_agreed") && e.target.checked) {
													setShowPrivacyModal(true);
												}
											}}
										/>
										<span className="text-sm text-gray-300">
											I agree to the <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }} className="text-blue-400 hover:underline font-medium">Privacy Policy</button> *
										</span>
									</label>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="mt-8 pt-6 border-t border-gray-700 flex flex-col gap-3">
							<button
								type="submit"
								disabled={isUpdating}
								className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
							>
								{isUpdating ? (
									<span className="flex items-center justify-center gap-2">
										<svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Saving...
									</span>
								) : "Save Changes"}
							</button>
							<button
								type="button"
								onClick={() => {
									memberForm.reset();
									sepaForm.reset();
									showToast("Changes reverted to last saved state.", "info");
								}}
								className="w-full px-4 py-2 bg-transparent hover:bg-gray-700/50 text-gray-400 hover:text-white font-medium rounded-lg transition-colors border border-transparent hover:border-gray-600"
							>
								Cancel
							</button>
						</div>
					</div>
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
