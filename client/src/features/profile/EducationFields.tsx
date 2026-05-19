import {
	Box,
	Button,
	Grid,
	MenuItem,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
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

export default function EducationFields({
	degreeValue,
	schoolValue,
	onChange,
}: EducationFieldsProps): JSX.Element {
	const theme = useTheme();
	const lastCommittedValues = useRef({
		degree: degreeValue ?? "",
		school: schoolValue ?? "",
	});
	const [entries, setEntries] = useState<EditableEducationEntry[]>(() =>
		getEditableEducationEntries(degreeValue, schoolValue),
	);
	const [customProgramRows, setCustomProgramRows] = useState<
		Record<number, boolean>
	>({});
	const [customSchoolRows, setCustomSchoolRows] = useState<
		Record<number, boolean>
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
		<Grid size={12}>
			<Box sx={{ display: "grid", gap: 2 }}>
				<Box>
					<Typography variant="subtitle2" color="text.secondary">
						Current studies
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Add every current degree program separately if you study more than
						one program.
					</Typography>
				</Box>

				{entries.map((entry, index) => {
					const { type, program } = splitDegree(entry.degree);
					const isPresetProgram = (
						DEGREE_PROGRAM_PRESETS as readonly string[]
					).includes(program);
					const selectedProgramOption = customProgramRows[index]
						? DEGREE_PROGRAM_CUSTOM_OPTION
						: program === ""
							? ""
							: isPresetProgram
								? program
								: DEGREE_PROGRAM_CUSTOM_OPTION;
					const isPresetSchool = (SCHOOL_PRESETS as readonly string[]).includes(
						entry.school,
					);
					const selectedSchoolOption = customSchoolRows[index]
						? SCHOOL_CUSTOM_OPTION
						: entry.school === ""
							? ""
							: isPresetSchool
								? entry.school
								: SCHOOL_CUSTOM_OPTION;

					return (
						<Box
							key={entry.id}
							sx={{
								p: 2,
								borderRadius: 3,
								backgroundColor:
									theme.palette.mode === "light"
										? "rgba(154, 100, 217, 0.06)"
										: "rgba(24, 17, 47, 0.72)",
							}}
						>
							<Grid container spacing={2}>
								<Grid size={{ xs: 12, sm: 6 }}>
									<TextField
										select
										label="Degree"
										value={type}
										onChange={(event) =>
											updateEntry(index, {
												degree: joinDegree(event.target.value, program),
											})
										}
									>
										<MenuItem value="">None</MenuItem>
										{DEGREE_TYPES.map((degreeType) => (
											<MenuItem key={degreeType} value={degreeType}>
												{degreeType}
											</MenuItem>
										))}
									</TextField>
								</Grid>

								<Grid size={{ xs: 12, sm: 6 }}>
									<TextField
										select
										label="Program"
										value={selectedProgramOption}
										onChange={(event) => {
											const chosen = event.target.value;
											if (chosen === DEGREE_PROGRAM_CUSTOM_OPTION) {
												setCustomProgramRows((current) => ({
													...current,
													[index]: true,
												}));
												updateEntry(index, { degree: joinDegree(type, "") });
												return;
											}
											setCustomProgramRows((current) => ({
												...current,
												[index]: false,
											}));
											updateEntry(index, { degree: joinDegree(type, chosen) });
										}}
									>
										<MenuItem value="">None</MenuItem>
										{DEGREE_PROGRAM_PRESETS.map((preset) => (
											<MenuItem key={preset} value={preset}>
												{preset}
											</MenuItem>
										))}
										<MenuItem value={DEGREE_PROGRAM_CUSTOM_OPTION}>
											Other (custom)
										</MenuItem>
									</TextField>
								</Grid>

								{selectedProgramOption === DEGREE_PROGRAM_CUSTOM_OPTION && (
									<Grid size={12}>
										<TextField
											label="Custom program name"
											value={program}
											onChange={(event) =>
												updateEntry(index, {
													degree: joinDegree(type, event.target.value),
												})
											}
										/>
									</Grid>
								)}

								<Grid size={12}>
									<TextField
										select
										label="School / University"
										value={selectedSchoolOption}
										onChange={(event) => {
											const chosen = event.target.value;
											if (chosen === SCHOOL_CUSTOM_OPTION) {
												setCustomSchoolRows((current) => ({
													...current,
													[index]: true,
												}));
												updateEntry(index, { school: "" });
												return;
											}
											setCustomSchoolRows((current) => ({
												...current,
												[index]: false,
											}));
											updateEntry(index, { school: chosen });
										}}
									>
										<MenuItem value="">None</MenuItem>
										{SCHOOL_PRESETS.map((preset) => (
											<MenuItem key={preset} value={preset}>
												{preset}
											</MenuItem>
										))}
										<MenuItem value={SCHOOL_CUSTOM_OPTION}>
											Other (custom)
										</MenuItem>
									</TextField>
								</Grid>

								{selectedSchoolOption === SCHOOL_CUSTOM_OPTION && (
									<Grid size={12}>
										<TextField
											label="Custom school / university"
											value={entry.school}
											onChange={(event) =>
												updateEntry(index, { school: event.target.value })
											}
										/>
									</Grid>
								)}
							</Grid>

							{entries.length > 1 && (
								<Button
									variant="text"
									onClick={() => removeEntry(index)}
									sx={{ mt: 1.5 }}
								>
									Remove study
								</Button>
							)}
						</Box>
					);
				})}

				<Button
					variant="outlined"
					onClick={() =>
						setEntries((current) => [
							...current,
							createEditableEducationEntry(),
						])
					}
					sx={{ justifySelf: "flex-start" }}
				>
					Add another study
				</Button>
			</Box>
		</Grid>
	);
}
