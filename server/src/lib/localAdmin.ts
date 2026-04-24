const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function isExplicitlyEnabled(value: string | undefined): boolean {
	return value ? TRUTHY_ENV_VALUES.has(value.trim().toLowerCase()) : false;
}

export function isLocalAdminBootstrapEnabled(
	supabaseUrl: string | undefined = process.env.SUPABASE_URL,
	enableLocalAdminBootstrap: string | undefined = process.env
		.ENABLE_LOCAL_ADMIN_BOOTSTRAP,
	nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
	if (nodeEnv === "production") return false;
	if (!isExplicitlyEnabled(enableLocalAdminBootstrap)) return false;
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
