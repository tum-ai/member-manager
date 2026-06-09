export interface PartnerJobsPage<TJob> {
	data: TJob[];
	next_cursor: string | null;
}

export async function fetchAllPartnerJobPages<TJob>(
	fetchPage: (cursor: string | null) => Promise<PartnerJobsPage<TJob>>,
): Promise<PartnerJobsPage<TJob>> {
	const jobs: TJob[] = [];
	let cursor: string | null = null;
	const seenCursors = new Set<string>();

	do {
		const page = await fetchPage(cursor);
		jobs.push(...page.data);
		cursor = page.next_cursor;

		if (cursor) {
			if (seenCursors.has(cursor)) {
				throw new Error("Partner jobs API returned a repeated cursor");
			}
			seenCursors.add(cursor);
		}
	} while (cursor);

	return {
		data: jobs,
		next_cursor: null,
	};
}
