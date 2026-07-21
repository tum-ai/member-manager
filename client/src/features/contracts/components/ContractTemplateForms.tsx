import {
	CONTRACT_CONDITION_TYPES,
	CONTRACT_DATA_TYPES,
	type ContractConditionType,
	type ContractVariableDataType,
} from "@member-manager/shared";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	CONTRACT_CONDITION_TYPE_LABELS,
	CONTRACT_DATA_TYPE_LABELS,
} from "@/features/contracts/contractTemplateOptions";

export function NewVariableForm({
	onSubmit,
	submitting,
	error,
}: {
	onSubmit: (values: {
		variable_name: string;
		label: string;
		data_type: ContractVariableDataType;
		help_text: string | null;
		options: string[] | null;
		is_required: boolean;
		is_multiselect: boolean;
		show_if_variable: string | null;
		show_if_value: string | null;
		sort_order: number;
	}) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [variableName, setVariableName] = useState("");
	const [label, setLabel] = useState("");
	const [dataType, setDataType] = useState<ContractVariableDataType>("TEXT");
	const [helpText, setHelpText] = useState("");
	const [optionsRaw, setOptionsRaw] = useState("");
	const [required, setRequired] = useState(false);

	const VARIABLE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
	const variableNameInvalid =
		variableName.trim().length > 0 &&
		!VARIABLE_NAME_RE.test(variableName.trim());

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-row gap-2">
				<Field
					className="min-w-[120px] flex-1"
					label="Variable name"
					htmlFor="new-variable-name"
					error={
						variableNameInvalid
							? "Must start with a letter; only letters, digits, underscores allowed"
							: undefined
					}
				>
					<Input
						id="new-variable-name"
						className="h-8"
						placeholder="partner_name"
						value={variableName}
						onChange={(event) => setVariableName(event.target.value)}
						aria-invalid={variableNameInvalid}
					/>
				</Field>
				<Field
					className="min-w-[120px] flex-1"
					label="Label"
					htmlFor="new-variable-label"
				>
					<Input
						id="new-variable-label"
						className="h-8"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
					/>
				</Field>
				<Field
					className="min-w-[140px] flex-1"
					label="Type"
					htmlFor="new-variable-type"
				>
					<Select
						value={dataType}
						onValueChange={(value) =>
							setDataType(value as ContractVariableDataType)
						}
					>
						<SelectTrigger
							id="new-variable-type"
							size="sm"
							aria-label="Type"
							className="w-full"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CONTRACT_DATA_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{CONTRACT_DATA_TYPE_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>
			<Field label="Help text (optional)" htmlFor="new-variable-help">
				<Input
					id="new-variable-help"
					className="h-8"
					value={helpText}
					onChange={(event) => setHelpText(event.target.value)}
				/>
			</Field>
			{dataType === "SELECT" ? (
				<Field label="Options (comma-separated)" htmlFor="new-variable-options">
					<Input
						id="new-variable-options"
						className="h-8"
						value={optionsRaw}
						onChange={(event) => setOptionsRaw(event.target.value)}
					/>
				</Field>
			) : null}
			<Label className="gap-2">
				<Checkbox
					checked={required}
					onCheckedChange={(checked) => setRequired(checked === true)}
				/>
				Required field
			</Label>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button
					size="sm"
					disabled={
						!variableName.trim() ||
						variableNameInvalid ||
						!label.trim() ||
						submitting
					}
					onClick={() => {
						const options =
							dataType === "SELECT" && optionsRaw.trim()
								? optionsRaw
										.split(",")
										.map((entry) => entry.trim())
										.filter(Boolean)
								: null;
						onSubmit({
							variable_name: variableName.trim(),
							label: label.trim(),
							data_type: dataType,
							help_text: helpText.trim() || null,
							options,
							is_required: required,
							is_multiselect: false,
							show_if_variable: null,
							show_if_value: null,
							sort_order: 0,
						});
						setVariableName("");
						setLabel("");
						setDataType("TEXT");
						setHelpText("");
						setOptionsRaw("");
						setRequired(false);
					}}
				>
					Save variable
				</Button>
			</div>
		</div>
	);
}

export function NewBlockForm({
	onSubmit,
	submitting,
	error,
}: {
	onSubmit: (values: {
		name: string;
		condition_type: ContractConditionType;
		condition_variable: string | null;
		condition_value: string | null;
		block_text: string;
		sort_order: number;
	}) => void;
	submitting: boolean;
	error: Error | null;
}): JSX.Element {
	const [name, setName] = useState("");
	const [conditionType, setConditionType] =
		useState<ContractConditionType>("ALWAYS");
	const [conditionVariable, setConditionVariable] = useState("");
	const [conditionValue, setConditionValue] = useState("");
	const [blockText, setBlockText] = useState("");

	const needsVariable = conditionType !== "ALWAYS";
	const needsValue = conditionType === "IF_VALUE";

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-row gap-2">
				<Field
					className="min-w-[120px] flex-1"
					label="Name"
					htmlFor="new-block-name"
				>
					<Input
						id="new-block-name"
						className="h-8"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</Field>
				<Field
					className="min-w-[140px] flex-1"
					label="Condition"
					htmlFor="new-block-condition"
				>
					<Select
						value={conditionType}
						onValueChange={(value) =>
							setConditionType(value as ContractConditionType)
						}
					>
						<SelectTrigger
							id="new-block-condition"
							size="sm"
							aria-label="Condition"
							className="w-full"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{CONTRACT_CONDITION_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{CONTRACT_CONDITION_TYPE_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				{needsVariable ? (
					<Field
						className="min-w-[100px] flex-1"
						label="Variable"
						htmlFor="new-block-variable"
					>
						<Input
							id="new-block-variable"
							className="h-8"
							value={conditionVariable}
							onChange={(event) => setConditionVariable(event.target.value)}
						/>
					</Field>
				) : null}
				{needsValue ? (
					<Field
						className="min-w-[100px] flex-1"
						label="Value"
						htmlFor="new-block-value"
					>
						<Input
							id="new-block-value"
							className="h-8"
							value={conditionValue}
							onChange={(event) => setConditionValue(event.target.value)}
						/>
					</Field>
				) : null}
			</div>
			<Field label="Block Text" htmlFor="new-block-text">
				<Textarea
					id="new-block-text"
					className="font-mono"
					value={blockText}
					onChange={(event) => setBlockText(event.target.value)}
					rows={3}
				/>
			</Field>
			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error.message}</AlertDescription>
				</Alert>
			) : null}
			<div>
				<Button
					size="sm"
					disabled={
						!name.trim() ||
						(needsVariable && !conditionVariable.trim()) ||
						submitting
					}
					onClick={() => {
						onSubmit({
							name: name.trim(),
							condition_type: conditionType,
							condition_variable: needsVariable
								? conditionVariable.trim()
								: null,
							condition_value: needsValue ? conditionValue.trim() : null,
							block_text: blockText,
							sort_order: 0,
						});
						setName("");
						setConditionType("ALWAYS");
						setConditionVariable("");
						setConditionValue("");
						setBlockText("");
					}}
				>
					Save block
				</Button>
			</div>
		</div>
	);
}
