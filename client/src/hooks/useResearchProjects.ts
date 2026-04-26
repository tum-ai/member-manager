import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";
import type { ResearchProject } from "../types";

export function useResearchProjects() {
	const {
		data: researchProjects,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["research-projects"],
		queryFn: async () => {
			return await apiClient<ResearchProject[]>("/api/research-projects", {
				method: "GET",
			});
		},
	});

	return {
		researchProjects,
		isLoading,
		error,
	};
}
