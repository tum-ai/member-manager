/** Central cache-key ownership for every Beacon client query. */
export const expertiseQueryKeys = {
	all: ["expertise"] as const,
	profile: (userId: string) => [...expertiseQueryKeys.all, userId] as const,
	tags: () => [...expertiseQueryKeys.all, "meta", "tags"] as const,
	preview: (userId: string) =>
		[...expertiseQueryKeys.all, "preview", userId] as const,
	agentLog: (chatId: string | null) =>
		[...expertiseQueryKeys.all, "agent-log", chatId] as const,
};
