export interface ProfileHeader {
	fullName: string;
	initials: string;
	meta: string;
}

/** The sidebar header derived from the (live) form values. */
export function getProfileHeader(values: {
	given_name?: string;
	surname?: string;
	department?: string;
	member_role?: string;
}): ProfileHeader {
	const givenName = values.given_name ?? "";
	const surname = values.surname ?? "";
	return {
		fullName: `${givenName} ${surname}`.trim(),
		initials: `${givenName.charAt(0)}${surname.charAt(0)}`.toUpperCase() || "?",
		meta: [values.department, values.member_role || "Member"]
			.filter(Boolean)
			.join(" · "),
	};
}
