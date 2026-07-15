import { CONTRACT_ADDONS, CONTRACT_PACKAGES } from "@member-manager/shared";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	ContractTemplateVariable,
	ContractVariableDataType,
} from "./useContracts";

interface DynamicFormProps {
	variables: ContractTemplateVariable[];
	values: Record<string, unknown>;
	onChange: (next: Record<string, unknown>) => void;
	disabled?: boolean;
}

export function isVisible(
	variable: ContractTemplateVariable,
	values: Record<string, unknown>,
): boolean {
	if (!variable.show_if_variable) return true;
	const guard = values[variable.show_if_variable];
	if (variable.show_if_value === null || variable.show_if_value === undefined) {
		return Boolean(guard);
	}
	const stringified =
		guard === null || guard === undefined ? "" : String(guard);
	return stringified === variable.show_if_value;
}

function parseOptions(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.map((entry) => String(entry));
	if (typeof raw === "string") {
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
		} catch {
			// Fallback: comma-separated string from the legacy editor.
			return raw
				.split(",")
				.map((entry) => entry.trim())
				.filter(Boolean);
		}
	}
	return [];
}

function formatOptionLabel(option: string): string {
	return (
		CONTRACT_PACKAGES[option]?.label ?? CONTRACT_ADDONS[option]?.label ?? option
	);
}

function HelpText({ text }: { text: string }): JSX.Element {
	return <p className="text-xs text-muted-foreground">{text}</p>;
}

// Light format check for EMAIL fields. The server re-validates
// with Zod; this only drives the inline hint.
export function isValidEmailInput(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function fieldFor(
	variable: ContractTemplateVariable,
	value: unknown,
	setValue: (next: unknown) => void,
	disabled: boolean,
) {
	const dataType: ContractVariableDataType = variable.data_type;
	switch (dataType) {
		case "EMAIL": {
			const current = typeof value === "string" ? value : "";
			const showInvalid = current.trim() !== "" && !isValidEmailInput(current);
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Input
						type="email"
						value={current}
						onChange={(event) => setValue(event.target.value)}
						required={variable.is_required}
						disabled={disabled}
						aria-invalid={showInvalid || undefined}
					/>
					{showInvalid ? (
						<p className="text-xs text-destructive">
							Enter a valid email address.
						</p>
					) : null}
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		}
		case "TEXTAREA":
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Textarea
						rows={3}
						value={typeof value === "string" ? value : ""}
						onChange={(event) => setValue(event.target.value)}
						required={variable.is_required}
						disabled={disabled}
					/>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		case "NUMBER":
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Input
						type="number"
						value={value === null || value === undefined ? "" : String(value)}
						onChange={(event) => {
							const next = event.target.value;
							setValue(next === "" ? null : Number(next));
						}}
						required={variable.is_required}
						disabled={disabled}
					/>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		case "DATE":
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Input
						type="date"
						value={typeof value === "string" ? value : ""}
						onChange={(event) => setValue(event.target.value)}
						required={variable.is_required}
						disabled={disabled}
					/>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		case "BOOLEAN":
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label className="gap-2">
						<Checkbox
							checked={value === true}
							onCheckedChange={(checked) => setValue(checked === true)}
							disabled={disabled}
						/>
						{variable.label}
					</Label>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		case "SELECT": {
			const options = parseOptions(variable.options);
			const multiple = variable.is_multiselect;
			if (multiple) {
				const currentValue = Array.isArray(value)
					? (value as unknown[]).map((entry) => String(entry))
					: [];
				const renderedValue =
					currentValue.length > 0
						? currentValue.map(formatOptionLabel).join(", ")
						: "";
				const toggle = (option: string) => {
					const next = currentValue.includes(option)
						? currentValue.filter((entry) => entry !== option)
						: [...currentValue, option];
					setValue(next);
				};
				return (
					<div className="flex min-w-0 flex-col gap-1.5">
						<Label>
							{variable.label}
							{variable.is_required ? " *" : ""}
						</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									type="button"
									variant="outline"
									disabled={disabled}
									aria-label={variable.label}
									className="w-full justify-between font-normal"
								>
									<span className="truncate">
										{renderedValue || (
											<span className="text-muted-foreground">Select…</span>
										)}
									</span>
									<span className="flex shrink-0 items-center gap-1.5">
										{currentValue.length > 0 ? (
											<span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
												{currentValue.length}
											</span>
										) : null}
										<ChevronDown className="size-4 opacity-50" />
									</span>
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-(--radix-popover-trigger-width) p-2">
								<div className="flex flex-col gap-1">
									{options.map((option) => (
										<Label
											key={option}
											className="gap-2 rounded-sm px-2 py-1.5 font-normal hover:bg-accent"
										>
											<Checkbox
												checked={currentValue.includes(option)}
												onCheckedChange={() => toggle(option)}
												disabled={disabled}
											/>
											{formatOptionLabel(option)}
										</Label>
									))}
								</div>
							</PopoverContent>
						</Popover>
						{variable.help_text ? <HelpText text={variable.help_text} /> : null}
					</div>
				);
			}
			const currentValue = typeof value === "string" ? value : "";
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Select
						value={currentValue || undefined}
						onValueChange={(next) => setValue(next)}
						disabled={disabled}
						required={variable.is_required}
					>
						<SelectTrigger className="w-full" aria-label={variable.label}>
							<SelectValue>
								{currentValue ? formatOptionLabel(currentValue) : null}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem key={option} value={option}>
									{formatOptionLabel(option)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
		}
		case "FILE":
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{`${variable.label} (Filename)`}
						{variable.is_required ? " *" : ""}
					</Label>
					<Input
						value={typeof value === "string" ? value : ""}
						onChange={(event) => setValue(event.target.value)}
						required={variable.is_required}
						disabled={disabled}
					/>
					<HelpText
						text={
							variable.help_text ??
							"File upload is not implemented in the MVP - enter a filename"
						}
					/>
				</div>
			);
		default:
			return (
				<div className="flex min-w-0 flex-col gap-1.5">
					<Label>
						{variable.label}
						{variable.is_required ? " *" : ""}
					</Label>
					<Input
						value={typeof value === "string" ? value : ""}
						onChange={(event) => setValue(event.target.value)}
						required={variable.is_required}
						disabled={disabled}
					/>
					{variable.help_text ? <HelpText text={variable.help_text} /> : null}
				</div>
			);
	}
}

export function DynamicForm({
	variables,
	values,
	onChange,
	disabled = false,
}: DynamicFormProps): JSX.Element {
	const sorted = [...variables].sort((a, b) => a.sort_order - b.sort_order);

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{sorted.map((variable) => {
				if (!isVisible(variable, values)) return null;
				const setValue = (next: unknown) => {
					onChange({ ...values, [variable.variable_name]: next });
				};
				// Long / wide inputs take the full row; short inputs pair up two per row.
				const fullWidth =
					variable.data_type === "TEXTAREA" ||
					(variable.data_type === "SELECT" && variable.is_multiselect);
				return (
					<div
						key={variable.id}
						className={fullWidth ? "sm:col-span-2" : undefined}
					>
						{fieldFor(
							variable,
							values[variable.variable_name],
							setValue,
							disabled,
						)}
					</div>
				);
			})}
		</div>
	);
}
