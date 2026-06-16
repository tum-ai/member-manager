// Slack/Gravatar avatar CDNs send no CORS headers, so loading them directly
// triggers cross-origin warnings and taints the org-tree export canvas. Route
// absolute http(s) avatars through our same-origin proxy (`/api/avatars`);
// leave relative/data URLs and empties untouched.
export function proxiedAvatarUrl(url?: string | null): string | undefined {
	const trimmed = url?.trim();
	if (!trimmed) return undefined;
	if (!/^https?:\/\//i.test(trimmed)) return trimmed;
	return `/api/avatars?url=${encodeURIComponent(trimmed)}`;
}
