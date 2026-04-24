const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function isLocalAdminBootstrapEnabled(
	supabaseUrl: string | undefined = process.env.SUPABASE_URL,
): boolean {
	if (!supabaseUrl) return false;

	try {
		const parsed = new URL(supabaseUrl);
		return LOCAL_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
}

export function isLocalAdminEmail(
	email: string | null | undefined,
	allowlist: string | undefined = process.env.LOCAL_ADMIN_EMAILS,
): boolean {
	const normalizedEmail = email?.trim().toLowerCase();
	if (!normalizedEmail || !allowlist?.trim()) {
		return false;
	}

	return allowlist
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)
		.includes(normalizedEmail);
}
