import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxCard } from "@/components/ui/checkbox-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useMemberData } from "../../hooks/useMemberData";
import { useSepaData } from "../../hooks/useSepaData";
import {
	type MemberSchema,
	memberSchema,
	type SepaSchema,
	sepaSchema,
} from "../../lib/schemas";
import type {
	DataPrivacyNoticeUpdateEventDetail,
	PrivacyUpdateEventDetail,
	SepaUpdateEventDetail,
} from "../../types";
import { DataPrivacyNotice } from "../legal/DataPrivacyNotice";
import { PrivacyPolicy } from "../legal/PrivacyPolicy";
import { SepaMandate } from "../sepa/SepaMandate";

interface MemberFormProps {
	user: User;
}

export function MemberForm({ user }: MemberFormProps) {
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

	const { dirtyFields: sepaDirtyFields } = sepaForm.formState;
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

	const isLoading = isLoadingMember || isLoadingSepa;
	const isUpdating = isUpdatingMember || isUpdatingSepa;

	if (isLoading)
		return (
			<div className="text-muted-foreground text-center p-8">Loading...</div>
		);

	return (
		<div className="flex justify-center items-start min-h-[calc(100vh-100px)] p-4 sm:p-8">
			<div className="w-full max-w-5xl bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
				<form
					onSubmit={memberForm.handleSubmit(onSubmit)}
					className="flex flex-col lg:flex-row"
				>
					<div className="flex-1 p-6 sm:p-8 lg:border-r border-border">
						<div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
							<h2 className="text-xl font-semibold text-foreground">
								Personal Information
							</h2>
							<Badge
								variant={memberForm.getValues("active") ? "success" : "danger"}
							>
								{memberForm.getValues("active") ? "Active Member" : "Inactive"}
							</Badge>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
							<Field
								className="sm:col-span-4"
								label="Salutation"
								htmlFor="salutation"
								required
								error={memberForm.formState.errors.salutation?.message}
							>
								<Controller
									control={memberForm.control}
									name="salutation"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id="salutation" className="w-full">
												<SelectValue placeholder="Select..." />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="Mr.">Mr.</SelectItem>
												<SelectItem value="Ms.">Ms.</SelectItem>
												<SelectItem value="Mx.">Mx.</SelectItem>
											</SelectContent>
										</Select>
									)}
								/>
							</Field>
							<Field className="sm:col-span-8" label="Title" htmlFor="title">
								<Controller
									control={memberForm.control}
									name="title"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id="title" className="w-full">
												<SelectValue placeholder="None" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="Dr.">Dr.</SelectItem>
												<SelectItem value="Prof.">Prof.</SelectItem>
											</SelectContent>
										</Select>
									)}
								/>
							</Field>

							<Field
								className="sm:col-span-6"
								label="First Name"
								htmlFor="given_name"
								required
								error={memberForm.formState.errors.given_name?.message}
							>
								<Input
									id="given_name"
									{...memberForm.register("given_name")}
									aria-invalid={!!memberForm.formState.errors.given_name}
									placeholder="John"
								/>
							</Field>
							<Field
								className="sm:col-span-6"
								label="Last Name"
								htmlFor="surname"
								required
								error={memberForm.formState.errors.surname?.message}
							>
								<Input
									id="surname"
									{...memberForm.register("surname")}
									aria-invalid={!!memberForm.formState.errors.surname}
									placeholder="Doe"
								/>
							</Field>

							<Field
								className="sm:col-span-8"
								label="Email"
								htmlFor="email"
								description="Managed by your account login"
							>
								<Input
									id="email"
									type="email"
									value={memberData?.email || user.email || ""}
									readOnly
								/>
							</Field>
							<Field
								className="sm:col-span-4"
								label="Date of Birth"
								htmlFor="date_of_birth"
								error={memberForm.formState.errors.date_of_birth?.message}
							>
								<Input
									id="date_of_birth"
									type="date"
									{...memberForm.register("date_of_birth")}
									aria-invalid={!!memberForm.formState.errors.date_of_birth}
								/>
							</Field>

							<Field
								className="sm:col-span-9"
								label="Street"
								htmlFor="street"
								required
								error={memberForm.formState.errors.street?.message}
							>
								<Input
									id="street"
									{...memberForm.register("street")}
									aria-invalid={!!memberForm.formState.errors.street}
								/>
							</Field>
							<Field
								className="sm:col-span-3"
								label="No."
								htmlFor="number"
								required
								error={memberForm.formState.errors.number?.message}
							>
								<Input
									id="number"
									{...memberForm.register("number")}
									aria-invalid={!!memberForm.formState.errors.number}
								/>
							</Field>

							<Field
								className="sm:col-span-4"
								label="Postal Code"
								htmlFor="postal_code"
								required
								error={memberForm.formState.errors.postal_code?.message}
							>
								<Input
									id="postal_code"
									{...memberForm.register("postal_code")}
									aria-invalid={!!memberForm.formState.errors.postal_code}
								/>
							</Field>
							<Field
								className="sm:col-span-8"
								label="City"
								htmlFor="city"
								required
								error={memberForm.formState.errors.city?.message}
							>
								<Input
									id="city"
									{...memberForm.register("city")}
									aria-invalid={!!memberForm.formState.errors.city}
								/>
							</Field>
							<Field
								className="sm:col-span-12"
								label="Country"
								htmlFor="country"
								required
								error={memberForm.formState.errors.country?.message}
							>
								<Input
									id="country"
									{...memberForm.register("country")}
									aria-invalid={!!memberForm.formState.errors.country}
									defaultValue="Germany"
								/>
							</Field>
						</div>

						<div className="mt-8 pt-6 border-t border-border">
							<button
								type="button"
								onClick={handleStatusChangeRequest}
								className="text-sm text-brand hover:text-brand/80 hover:underline transition-colors flex items-center gap-1"
							>
								Need to change your membership status?
							</button>
							{statusRequestMessage && (
								<div className="mt-3 p-3 bg-accent border border-border rounded text-sm text-foreground">
									{statusRequestMessage}
								</div>
							)}
						</div>
					</div>

					<div className="lg:w-96 bg-muted/50 p-6 sm:p-8 flex flex-col justify-between">
						<div>
							<h2 className="text-xl font-semibold text-foreground mb-6 pb-4 border-b border-border">
								Banking Details
							</h2>

							<div className="space-y-4">
								<Field
									label="IBAN"
									htmlFor="iban"
									required
									error={sepaForm.formState.errors.iban?.message}
								>
									<Input
										id="iban"
										{...sepaForm.register("iban")}
										aria-invalid={!!sepaForm.formState.errors.iban}
										className="font-mono"
										placeholder="DE..."
									/>
								</Field>

								<Field label="BIC" htmlFor="bic">
									<Input
										id="bic"
										{...sepaForm.register("bic")}
										className="font-mono"
									/>
								</Field>

								<Field
									label="Bank Name"
									htmlFor="bank_name"
									required
									error={sepaForm.formState.errors.bank_name?.message}
								>
									<Input
										id="bank_name"
										{...sepaForm.register("bank_name")}
										aria-invalid={!!sepaForm.formState.errors.bank_name}
									/>
								</Field>

								<div className="pt-4 space-y-3">
									<Controller
										control={sepaForm.control}
										name="mandate_agreed"
										render={({ field }) => (
											<CheckboxCard
												checked={field.value}
												onCheckedChange={(checked) => {
													const next = checked === true;
													sepaForm.setValue("mandate_agreed", next, {
														shouldDirty: true,
													});
													if (!sepaForm.getValues("mandate_agreed") && next) {
														setShowSepaModal(true);
													}
												}}
											>
												I agree to the{" "}
												<LinkButton
													className="font-medium"
													onClick={(e) => {
														e.preventDefault();
														setShowSepaModal(true);
													}}
												>
													SEPA mandate
												</LinkButton>
											</CheckboxCard>
										)}
									/>

									<Controller
										control={sepaForm.control}
										name="privacy_agreed"
										render={({ field }) => (
											<CheckboxCard
												checked={field.value}
												disabled={sepaForm.getValues("privacy_agreed")}
												onCheckedChange={(checked) => {
													const next = checked === true;
													sepaForm.setValue("privacy_agreed", next, {
														shouldDirty: true,
													});
													if (!sepaForm.getValues("privacy_agreed") && next) {
														setShowPrivacyModal(true);
													}
												}}
											>
												I agree to the{" "}
												<LinkButton
													className="font-medium"
													onClick={(e) => {
														e.preventDefault();
														setShowPrivacyModal(true);
													}}
												>
													Privacy Policy
												</LinkButton>{" "}
												*
											</CheckboxCard>
										)}
									/>

									<Controller
										control={sepaForm.control}
										name="data_privacy_notice_agreed"
										render={() => (
											<CheckboxCard
												checked={sepaForm.getValues(
													"data_privacy_notice_agreed",
												)}
												disabled={sepaForm.getValues(
													"data_privacy_notice_agreed",
												)}
												onCheckedChange={(checked) => {
													if (checked === true) {
														setShowDataPrivacyNoticeModal(true);
														return;
													}
													sepaForm.setValue(
														"data_privacy_notice_agreed",
														false,
														{
															shouldDirty: true,
														},
													);
												}}
											>
												I agree to the{" "}
												<LinkButton
													className="font-medium"
													onClick={(e) => {
														e.preventDefault();
														setShowDataPrivacyNoticeModal(true);
													}}
												>
													Data Privacy Notice
												</LinkButton>{" "}
												*
											</CheckboxCard>
										)}
									/>
								</div>
							</div>
						</div>

						<div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
							<Button type="submit" disabled={isUpdating} className="w-full">
								{isUpdating ? (
									<span className="flex items-center justify-center gap-2">
										<Spinner />
										Saving...
									</span>
								) : (
									"Save Changes"
								)}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full text-muted-foreground"
								onClick={() => {
									memberForm.reset();
									sepaForm.reset();
									showToast("Changes reverted to last saved state.", "info");
								}}
							>
								Cancel
							</Button>
						</div>
					</div>
				</form>
			</div>

			{showSepaModal && (
				<Modal
					title="SEPA Mandate Agreement"
					onClose={() => setShowSepaModal(false)}
					confirmDisabled={!mandateAgreed || !sepaDirtyFields.mandate_agreed}
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
						sepaAgreed={mandateAgreed}
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
					confirmDisabled={!privacyAgreed || !sepaDirtyFields.privacy_agreed}
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
						privacyAgreed={privacyAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("privacy_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}

			{showDataPrivacyNoticeModal && (
				<Modal
					title="Data Privacy Notice Agreement"
					onClose={() => setShowDataPrivacyNoticeModal(false)}
					confirmDisabled={
						!dataPrivacyNoticeAgreed ||
						!sepaDirtyFields.data_privacy_notice_agreed
					}
					onConfirm={() => {
						sepaForm.setValue("data_privacy_notice_agreed", true, {
							shouldDirty: true,
						});
						window.dispatchEvent(
							new CustomEvent("data-privacy-notice-updated", {
								detail: { data_privacy_notice_agreed: true },
							}),
						);
						setShowDataPrivacyNoticeModal(false);
					}}
				>
					<DataPrivacyNotice
						dataPrivacyNoticeAgreed={dataPrivacyNoticeAgreed}
						onCheckChange={(checked) =>
							sepaForm.setValue("data_privacy_notice_agreed", checked, {
								shouldDirty: true,
							})
						}
					/>
				</Modal>
			)}
		</div>
	);
}
