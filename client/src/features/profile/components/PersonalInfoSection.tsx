import { UserRound } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	fromSelectValue,
	NONE_VALUE,
	toSelectValue,
} from "@/features/profile/profileUtils";
import type { MemberSchema } from "@/lib/schemas";
import { SectionHeading } from "./SectionHeading";

interface PersonalInfoSectionProps {
	memberForm: UseFormReturn<MemberSchema>;
	email: string;
	ids: {
		salutation: string;
		title: string;
		givenName: string;
		surname: string;
		email: string;
		dob: string;
		street: string;
		number: string;
		postalCode: string;
		city: string;
		country: string;
	};
}

export function PersonalInfoSection({
	memberForm,
	email,
	ids,
}: PersonalInfoSectionProps): JSX.Element {
	const errors = memberForm.formState.errors;

	return (
		<GlassCard id="personal" variant="elevated" className="scroll-mt-20">
			<CardContent className="p-6">
				<SectionHeading
					icon={UserRound}
					title="Personal information"
					description="Your name and contact details."
				/>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
					<Field
						className="sm:col-span-4"
						label="Salutation (optional)"
						htmlFor={ids.salutation}
						error={errors.salutation?.message}
					>
						<Select
							value={toSelectValue(memberForm.watch("salutation") || "")}
							onValueChange={(value) =>
								memberForm.setValue("salutation", fromSelectValue(value), {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger
								id={ids.salutation}
								className="w-full"
								aria-label="Salutation (optional)"
								aria-invalid={!!errors.salutation}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								<SelectItem value="Mr.">Mr.</SelectItem>
								<SelectItem value="Ms.">Ms.</SelectItem>
								<SelectItem value="Mx.">Mx.</SelectItem>
							</SelectContent>
						</Select>
					</Field>
					<Field className="sm:col-span-8" label="Title" htmlFor={ids.title}>
						<Select
							value={toSelectValue(memberForm.watch("title") || "")}
							onValueChange={(value) =>
								memberForm.setValue("title", fromSelectValue(value), {
									shouldDirty: true,
								})
							}
						>
							<SelectTrigger
								id={ids.title}
								className="w-full"
								aria-label="Title"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>None</SelectItem>
								<SelectItem value="Dr.">Dr.</SelectItem>
								<SelectItem value="Prof.">Prof.</SelectItem>
							</SelectContent>
						</Select>
					</Field>

					<Field
						className="sm:col-span-6"
						label="First Name"
						htmlFor={ids.givenName}
						required
						error={errors.given_name?.message}
					>
						<Input
							id={ids.givenName}
							{...memberForm.register("given_name")}
							aria-invalid={!!errors.given_name}
							required
						/>
					</Field>
					<Field
						className="sm:col-span-6"
						label="Last Name"
						htmlFor={ids.surname}
						required
						error={errors.surname?.message}
					>
						<Input
							id={ids.surname}
							{...memberForm.register("surname")}
							aria-invalid={!!errors.surname}
							required
						/>
					</Field>

					<Field
						className="sm:col-span-8"
						label="Email"
						htmlFor={ids.email}
						description="Managed by your account login"
					>
						<Input
							id={ids.email}
							type="email"
							value={email}
							disabled
							readOnly
						/>
					</Field>
					<Field
						className="sm:col-span-4"
						label="Date of Birth"
						htmlFor={ids.dob}
						error={errors.date_of_birth?.message}
					>
						<Input
							id={ids.dob}
							type="date"
							{...memberForm.register("date_of_birth")}
							aria-invalid={!!errors.date_of_birth}
						/>
					</Field>

					<div className="sm:col-span-12">
						<p className="mt-2 mb-2 text-sm font-medium text-muted-foreground">
							Address
						</p>
					</div>

					<Field
						className="sm:col-span-9"
						label="Street"
						htmlFor={ids.street}
						error={errors.street?.message}
					>
						<Input
							id={ids.street}
							{...memberForm.register("street")}
							aria-invalid={!!errors.street}
						/>
					</Field>
					<Field
						className="sm:col-span-3"
						label="Number"
						htmlFor={ids.number}
						error={errors.number?.message}
					>
						<Input
							id={ids.number}
							{...memberForm.register("number")}
							aria-invalid={!!errors.number}
						/>
					</Field>

					<Field
						className="sm:col-span-4"
						label="Postal Code"
						htmlFor={ids.postalCode}
						error={errors.postal_code?.message}
					>
						<Input
							id={ids.postalCode}
							{...memberForm.register("postal_code")}
							aria-invalid={!!errors.postal_code}
						/>
					</Field>
					<Field
						className="sm:col-span-8"
						label="City"
						htmlFor={ids.city}
						error={errors.city?.message}
					>
						<Input
							id={ids.city}
							{...memberForm.register("city")}
							aria-invalid={!!errors.city}
						/>
					</Field>

					<Field
						className="sm:col-span-12"
						label="Country"
						htmlFor={ids.country}
						error={errors.country?.message}
					>
						<Input
							id={ids.country}
							{...memberForm.register("country")}
							aria-invalid={!!errors.country}
						/>
					</Field>
				</div>
			</CardContent>
		</GlassCard>
	);
}
