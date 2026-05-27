import {
	Box,
	Checkbox,
	FormControl,
	FormControlLabel,
	FormHelperText,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
} from "@mui/material";
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

function isVisible(
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

function fieldFor(
	variable: ContractTemplateVariable,
	value: unknown,
	setValue: (next: unknown) => void,
	disabled: boolean,
) {
	const dataType: ContractVariableDataType = variable.data_type;
	switch (dataType) {
		case "TEXTAREA":
			return (
				<TextField
					label={variable.label}
					multiline
					minRows={3}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => setValue(event.target.value)}
					required={variable.is_required}
					helperText={variable.help_text ?? undefined}
					disabled={disabled}
					fullWidth
				/>
			);
		case "NUMBER":
			return (
				<TextField
					label={variable.label}
					type="number"
					value={value === null || value === undefined ? "" : String(value)}
					onChange={(event) => {
						const next = event.target.value;
						setValue(next === "" ? null : Number(next));
					}}
					required={variable.is_required}
					helperText={variable.help_text ?? undefined}
					disabled={disabled}
					fullWidth
				/>
			);
		case "DATE":
			return (
				<TextField
					label={variable.label}
					type="date"
					value={typeof value === "string" ? value : ""}
					onChange={(event) => setValue(event.target.value)}
					required={variable.is_required}
					helperText={variable.help_text ?? undefined}
					disabled={disabled}
					InputLabelProps={{ shrink: true }}
					fullWidth
				/>
			);
		case "BOOLEAN":
			return (
				<FormControl>
					<FormControlLabel
						control={
							<Checkbox
								checked={value === true}
								onChange={(event) => setValue(event.target.checked)}
								disabled={disabled}
							/>
						}
						label={variable.label}
					/>
					{variable.help_text ? (
						<FormHelperText>{variable.help_text}</FormHelperText>
					) : null}
				</FormControl>
			);
		case "SELECT": {
			const options = parseOptions(variable.options);
			const multiple = variable.is_multiselect;
			const currentValue = multiple
				? Array.isArray(value)
					? (value as unknown[]).map((entry) => String(entry))
					: []
				: typeof value === "string"
					? value
					: "";
			return (
				<FormControl
					fullWidth
					required={variable.is_required}
					disabled={disabled}
				>
					<InputLabel>{variable.label}</InputLabel>
					<Select
						label={variable.label}
						multiple={multiple}
						value={currentValue as string | string[]}
						onChange={(event) =>
							setValue(
								multiple
									? (event.target.value as unknown as string[])
									: (event.target.value as unknown as string),
							)
						}
					>
						{options.map((option) => (
							<MenuItem key={option} value={option}>
								{option}
							</MenuItem>
						))}
					</Select>
					{variable.help_text ? (
						<FormHelperText>{variable.help_text}</FormHelperText>
					) : null}
				</FormControl>
			);
		}
		case "FILE":
			return (
				<TextField
					label={`${variable.label} (Filename)`}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => setValue(event.target.value)}
					required={variable.is_required}
					helperText={
						variable.help_text ??
						"File upload is not implemented in the MVP - enter a filename"
					}
					disabled={disabled}
					fullWidth
				/>
			);
		default:
			return (
				<TextField
					label={variable.label}
					value={typeof value === "string" ? value : ""}
					onChange={(event) => setValue(event.target.value)}
					required={variable.is_required}
					helperText={variable.help_text ?? undefined}
					disabled={disabled}
					fullWidth
				/>
			);
	}
}

export default function DynamicForm({
	variables,
	values,
	onChange,
	disabled = false,
}: DynamicFormProps): JSX.Element {
	const sorted = [...variables].sort((a, b) => a.sort_order - b.sort_order);

	return (
		<Stack spacing={2}>
			{sorted.map((variable) => {
				if (!isVisible(variable, values)) return null;
				const setValue = (next: unknown) => {
					onChange({ ...values, [variable.variable_name]: next });
				};
				return (
					<Box key={variable.id}>
						{fieldFor(
							variable,
							values[variable.variable_name],
							setValue,
							disabled,
						)}
					</Box>
				);
			})}
		</Stack>
	);
}
