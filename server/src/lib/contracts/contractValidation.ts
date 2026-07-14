import { z } from "zod";

export function findInvalidContractEmailFields(
	variables: Array<Record<string, unknown>>,
	formData: Record<string, unknown>,
): string[] {
	const invalid: string[] = [];
	for (const variable of variables) {
		if (variable.data_type !== "EMAIL") continue;
		const name =
			typeof variable.variable_name === "string" ? variable.variable_name : "";
		if (!name) continue;
		const value = formData[name];
		if (value === undefined || value === null || value === "") continue;
		if (!z.string().trim().email().safeParse(value).success) {
			invalid.push(
				typeof variable.label === "string" && variable.label
					? variable.label
					: name,
			);
		}
	}
	return invalid;
}
