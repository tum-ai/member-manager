import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
	DEGREE_PROGRAM_CUSTOM_OPTION,
	DEGREE_PROGRAM_PRESETS,
	DEGREE_TYPES,
	SCHOOL_CUSTOM_OPTION,
	SCHOOL_PRESETS,
} from "../../lib/constants";
import {
	type EducationEntry,
	getEducationEntries,
	joinDegree,
	serializeEducationEntries,
	splitDegree,
} from "../../lib/memberMetadata";

// Radix Select forbids empty-string item values, so an empty selection is
// represented by this sentinel and mapped back to "" at the boundary.
const NONE_VALUE = "__none__";
const toSelectValue = (value: string): string =>
	value === "" ? NONE_VALUE : value;
const fromSelectValue = (value: string): string =>
	value === NONE_VALUE ? "" : value;

interface EducationFieldsProps {
	degreeValue?: string | null;
	schoolValue?: string | null;
	onChange: (values: { degree: string; school: string }) => void;
}

interface EditableEducationEntry extends EducationEntry {
	id: string;
}

let nextEducationEntryId = 0;

function createEditableEducationEntry(
	entry: EducationEntry = { degree: "", school: "" },
): EditableEducationEntry {
	nextEducationEntryId += 1;
	return { ...entry, id: `education-entry-${nextEducationEntryId}` };
}

function getEditableEducationEntries(
	degree?: string | null,
	school?: string | null,
): EditableEducationEntry[] {
	const entries = getEducationEntries(degree, school);
	return entries.length > 0
		? entries.map((entry) => createEditableEducationEntry(entry))
		: [createEditableEducationEntry()];
}

export function EducationFields({
	degreeValue,
	schoolValue,
	onChange,
}: EducationFieldsProps): JSX.Element {
	const fieldId = useId();
	const lastCommittedValues = useRef({
		degree: degreeValue ?? "",
		school: schoolValue ?? "",
	});
	const [entries, setEntries] = useState<EditableEducationEntry[]>(() =>
		getEditableEducationEntries(degreeValue, schoolValue),
	);
	const [customProgramRows, setCustomProgramRows] = useState<
		Record<string, boolean>
	>({});
	const [customSchoolRows, setCustomSchoolRows] = useState<
		Record<string, boolean>
	>({});

	useEffect(() => {
		const incomingValues = {
			degree: degreeValue ?? "",
			school: schoolValue ?? "",
		};
		if (
			incomingValues.degree === lastCommittedValues.current.degree &&
			incomingValues.school === lastCommittedValues.current.school
		) {
			return;
		}

		lastCommittedValues.current = incomingValues;
		setEntries(getEditableEducationEntries(degreeValue, schoolValue));
		setCustomProgramRows({});
		setCustomSchoolRows({});
	}, [degreeValue, schoolValue]);

	const commitEntries = (nextEntries: EditableEducationEntry[]): void => {
		const entriesToStore = nextEntries.map(({ id: _id, ...entry }) => entry);
		const serializedValues = serializeEducationEntries(entriesToStore);
		lastCommittedValues.current = serializedValues;
		setEntries(
			nextEntries.length > 0 ? nextEntries : [createEditableEducationEntry()],
		);
		onChange(serializedValues);
	};

	const updateEntry = (index: number, patch: Partial<EducationEntry>): void => {
		const nextEntries = entries.map((entry, entryIndex) =>
			entryIndex === index ? { ...entry, ...patch } : entry,
		);
		commitEntries(nextEntries);
	};

	const removeEntry = (index: number): void => {
		commitEntries(entries.filter((_, entryIndex) => entryIndex !== index));
	};

	return (
		<div className="col-span-full">
			<div className="grid gap-4">
				<div>
					<p className="text-sm font-medium text-muted-foreground">
						Current studies
					</p>
					<p className="text-sm text-muted-foreground">
						Add every current degree program separately if you study more than
						one program.
					</p>
				</div>

				{entries.map((entry, index) => {
					const { type, program } = splitDegree(entry.degree);
					const isPresetProgram = (
						DEGREE_PROGRAM_PRESETS as readonly string[]
					).includes(program);
					const selectedProgramOption = customProgramRows[entry.id]
						? DEGREE_PROGRAM_CUSTOM_OPTION
						: program === ""
							? ""
							: isPresetProgram
								? program
								: DEGREE_PROGRAM_CUSTOM_OPTION;
					const isPresetSchool = (SCHOOL_PRESETS as readonly string[]).includes(
						entry.school,
					);
					const selectedSchoolOption = customSchoolRows[entry.id]
						? SCHOOL_CUSTOM_OPTION
						: entry.school === ""
							? ""
							: isPresetSchool
								? entry.school
								: SCHOOL_CUSTOM_OPTION;
					const degreeId = `${fieldId}-degree-${entry.id}`;
					const programId = `${fieldId}-program-${entry.id}`;
					const customProgramId = `${fieldId}-custom-program-${entry.id}`;
					const schoolId = `${fieldId}-school-${entry.id}`;
					const customSchoolId = `${fieldId}-custom-school-${entry.id}`;

					return (
						<div
							key={entry.id}
							className={cn(index > 0 && "border-t border-border pt-4")}
						>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="grid gap-1.5">
									<Label htmlFor={degreeId}>Degree</Label>
									<Select
										value={toSelectValue(type)}
										onValueChange={(value) =>
											updateEntry(index, {
												degree: joinDegree(fromSelectValue(value), program),
											})
										}
									>
										<SelectTrigger
											id={degreeId}
											className="w-full"
											aria-label="Degree"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>None</SelectItem>
											{DEGREE_TYPES.map((degreeType) => (
												<SelectItem key={degreeType} value={degreeType}>
													{degreeType}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="grid gap-1.5">
									<Label htmlFor={programId}>Program</Label>
									<Select
										value={toSelectValue(selectedProgramOption)}
										onValueChange={(rawChosen) => {
											const chosen = fromSelectValue(rawChosen);
											if (chosen === DEGREE_PROGRAM_CUSTOM_OPTION) {
												setCustomProgramRows((current) => ({
													...current,
													[entry.id]: true,
												}));
												updateEntry(index, { degree: joinDegree(type, "") });
												return;
											}
											setCustomProgramRows((current) => ({
												...current,
												[entry.id]: false,
											}));
											updateEntry(index, { degree: joinDegree(type, chosen) });
										}}
									>
										<SelectTrigger
											id={programId}
											className="w-full"
											aria-label="Program"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>None</SelectItem>
											{DEGREE_PROGRAM_PRESETS.map((preset) => (
												<SelectItem key={preset} value={preset}>
													{preset}
												</SelectItem>
											))}
											<SelectItem value={DEGREE_PROGRAM_CUSTOM_OPTION}>
												Other (custom)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{selectedProgramOption === DEGREE_PROGRAM_CUSTOM_OPTION && (
									<div className="col-span-full grid gap-1.5">
										<Label htmlFor={customProgramId}>Custom program name</Label>
										<Input
											id={customProgramId}
											value={program}
											onChange={(event) =>
												updateEntry(index, {
													degree: joinDegree(type, event.target.value),
												})
											}
										/>
									</div>
								)}

								<div className="col-span-full grid gap-1.5">
									<Label htmlFor={schoolId}>School / University</Label>
									<Select
										value={toSelectValue(selectedSchoolOption)}
										onValueChange={(rawChosen) => {
											const chosen = fromSelectValue(rawChosen);
											if (chosen === SCHOOL_CUSTOM_OPTION) {
												setCustomSchoolRows((current) => ({
													...current,
													[entry.id]: true,
												}));
												updateEntry(index, { school: "" });
												return;
											}
											setCustomSchoolRows((current) => ({
												...current,
												[entry.id]: false,
											}));
											updateEntry(index, { school: chosen });
										}}
									>
										<SelectTrigger
											id={schoolId}
											className="w-full"
											aria-label="School / University"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE_VALUE}>None</SelectItem>
											{SCHOOL_PRESETS.map((preset) => (
												<SelectItem key={preset} value={preset}>
													{preset}
												</SelectItem>
											))}
											<SelectItem value={SCHOOL_CUSTOM_OPTION}>
												Other (custom)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{selectedSchoolOption === SCHOOL_CUSTOM_OPTION && (
									<div className="col-span-full grid gap-1.5">
										<Label htmlFor={customSchoolId}>
											Custom school / university
										</Label>
										<Input
											id={customSchoolId}
											value={entry.school}
											onChange={(event) =>
												updateEntry(index, { school: event.target.value })
											}
										/>
									</div>
								)}
							</div>

							{entries.length > 1 && (
								<Button
									variant="ghost"
									onClick={() => removeEntry(index)}
									className="mt-3"
								>
									Remove study
								</Button>
							)}
						</div>
					);
				})}

				<Button
					variant="outline"
					onClick={() =>
						setEntries((current) => [
							...current,
							createEditableEducationEntry(),
						])
					}
					className="justify-self-start"
				>
					Add another study
				</Button>
			</div>
		</div>
	);
}
