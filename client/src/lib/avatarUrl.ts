// Slack/Gravatar avatar CDNs send no CORS headers, so loading them directly
// triggers cross-origin warnings and taints the org-tree export canvas. Route
// absolute http(s) avatars through our same-origin proxy (`/api/avatars`);
// leave relative/data URLs and empties untouched. The proxy path is made
// absolute (origin-prefixed) so it also resolves correctly from inside the
// org-tree SVG <foreignObject>.
export function proxiedAvatarUrl(url?: string | null): string | undefined {
	const trimmed = url?.trim();
	if (!trimmed) return undefined;
	if (!/^https?:\/\//i.test(trimmed)) return trimmed;
	const origin = typeof window === "undefined" ? "" : window.location.origin;
	return `${origin}/api/avatars?url=${encodeURIComponent(trimmed)}`;
}
