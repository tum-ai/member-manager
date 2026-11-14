import {
	type DevMcpCatalog,
	devMcpCatalogSchema,
} from "@member-manager/shared";
import { BadGatewayError, ServiceUnavailableError } from "./errors.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";

/**
 * Talking to dev-mcp (`tum-ai/dev-mcp`, the MCP server behind Dev Claude).
 *
 * One shared secret, `DEV_MCP_SERVICE_TOKEN`, authenticates both directions:
 * dev-mcp calls member-manager's service API with it
 * (`routes/devMcpAccess.ts`), and member-manager calls dev-mcp's
 * `GET <DEV_MCP_URL>/service/catalog` with it for the tool catalog the admin
 * page and the role presets need.
 */

export const DEV_MCP_CATALOG_TIMEOUT_MS = 5_000;
/** New workflows show up within a minute; admins rarely need it fresher. */
export const DEV_MCP_CATALOG_TTL_MS = 60_000;

export interface DevMcpConfig {
	/** dev-mcp's base URL without a trailing slash, e.g. https://tumai-dev-mcp.vercel.app. */
	url: string | null;
	serviceToken: string | null;
}

export function readDevMcpConfig(
	env: NodeJS.ProcessEnv = process.env,
): DevMcpConfig {
	const url = env.DEV_MCP_URL?.trim().replace(/\/+$/, "") || null;
	const serviceToken = env.DEV_MCP_SERVICE_TOKEN?.trim() || null;
	return { url, serviceToken };
}

let serviceTokenOverride: string | null | undefined;

/**
 * The secret dev-mcp presents to the service API; null while unset. Read on
 * every request (like `PARTNER_EXPORT_TOKEN`), so a rotation applies on the
 * next cold start without code changes.
 */
export function getDevMcpServiceToken(): string | null {
	return serviceTokenOverride !== undefined
		? serviceTokenOverride
		: readDevMcpConfig().serviceToken;
}

/** Test seam: pins the service token; `undefined` reads the env again. */
export function setDevMcpServiceToken(value: string | null | undefined): void {
	serviceTokenOverride = value;
}

export interface DevMcpCatalogClient {
	/**
	 * dev-mcp's tool catalog, cached for {@link DEV_MCP_CATALOG_TTL_MS}.
	 * Throws a 503 when dev-mcp isn't configured or can't be reached, and a
	 * 502 when it answers with an error or an unexpected body. Failures are
	 * not cached.
	 */
	getCatalog(): Promise<DevMcpCatalog>;
}

type FetchLike = (
	input: string,
	init: RequestInit,
	timeoutMs: number,
) => Promise<Response>;

export interface DevMcpCatalogClientOptions {
	config: DevMcpConfig;
	fetch?: FetchLike;
	timeoutMs?: number;
	ttlMs?: number;
	now?: () => number;
}

export function createDevMcpCatalogClient({
	config,
	fetch = fetchWithTimeout,
	timeoutMs = DEV_MCP_CATALOG_TIMEOUT_MS,
	ttlMs = DEV_MCP_CATALOG_TTL_MS,
	now = Date.now,
}: DevMcpCatalogClientOptions): DevMcpCatalogClient {
	let cached: { catalog: DevMcpCatalog; expiresAt: number } | null = null;
	let inFlight: Promise<DevMcpCatalog> | null = null;

	async function load(url: string, token: string): Promise<DevMcpCatalog> {
		let response: Response;
		try {
			response = await fetch(
				`${url}/service/catalog`,
				{
					headers: {
						accept: "application/json",
						authorization: `Bearer ${token}`,
					},
				},
				timeoutMs,
			);
		} catch {
			throw new ServiceUnavailableError(
				"Dev MCP can't be reached right now; try again shortly",
			);
		}
		if (!response.ok) {
			throw new BadGatewayError(
				`Dev MCP answered ${response.status} for its tool catalog`,
			);
		}
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new BadGatewayError("Dev MCP sent a tool catalog that isn't JSON");
		}
		const parsed = devMcpCatalogSchema.safeParse(body);
		if (!parsed.success) {
			throw new BadGatewayError("Dev MCP sent an unexpected tool catalog");
		}
		cached = { catalog: parsed.data, expiresAt: now() + ttlMs };
		return parsed.data;
	}

	return {
		async getCatalog() {
			if (cached && cached.expiresAt > now()) {
				return cached.catalog;
			}
			const { url, serviceToken } = config;
			if (!url || !serviceToken) {
				throw new ServiceUnavailableError(
					"Dev MCP isn't configured (DEV_MCP_URL, DEV_MCP_SERVICE_TOKEN)",
				);
			}
			// Concurrent callers share one request.
			inFlight ??= load(url, serviceToken).finally(() => {
				inFlight = null;
			});
			return inFlight;
		},
	};
}

let defaultClient: DevMcpCatalogClient | undefined;

/** dev-mcp's catalog through the process-wide client (configured from env). */
export function getDevMcpCatalog(): Promise<DevMcpCatalog> {
	defaultClient ??= createDevMcpCatalogClient({ config: readDevMcpConfig() });
	return defaultClient.getCatalog();
}

/** Test seam, like `setSupabaseClient`; `undefined` rebuilds from env. */
export function setDevMcpCatalogClient(
	client: DevMcpCatalogClient | undefined,
): void {
	defaultClient = client;
}
