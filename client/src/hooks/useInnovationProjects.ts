import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../lib/apiClient";
import type { InnovationProject } from "../types";

export function useInnovationProjects() {
	const {
		data: innovationProjects,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["innovation-projects"],
		queryFn: async () => {
			return await apiClient<InnovationProject[]>("/api/innovation-projects", {
				method: "GET",
			});
		},
	});

	return {
		innovationProjects,
		isLoading,
		error,
	};
}
