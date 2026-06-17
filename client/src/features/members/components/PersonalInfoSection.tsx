import { Controller, type UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { MemberSchema } from "@/lib/schemas";

interface PersonalInfoSectionProps {
	memberForm: UseFormReturn<MemberSchema>;
	email: string;
	statusRequestMessage: string;
	onStatusChangeRequest: () => void;
}

export function PersonalInfoSection({
	memberForm,
	email,
	statusRequestMessage,
	onStatusChangeRequest,
}: PersonalInfoSectionProps) {
	return (
		<div className="flex-1 p-6 sm:p-8 lg:border-r border-border">
			<div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
				<h2 className="text-xl font-semibold text-foreground">
					Personal Information
				</h2>
				<Badge variant={memberForm.getValues("active") ? "success" : "danger"}>
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
					<Input id="email" type="email" value={email} readOnly />
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
					onClick={onStatusChangeRequest}
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
	);
}
