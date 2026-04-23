import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

interface EnvLayer {
	file: string;
	override: boolean;
}

// Matches Vite/Next conventions:
//   - `.env`:       baseline defaults; MUST NOT clobber platform env (Vercel etc.)
//   - `.env.local`: explicit developer override; wins over everything.
const DEFAULT_LAYERS: readonly EnvLayer[] = [
	{ file: ".env", override: false },
	{ file: ".env.local", override: true },
];

export const DEFAULT_ENV_CHAIN: readonly string[] = DEFAULT_LAYERS.map(
	(l) => l.file,
);

const packageRootDefault = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);

export interface LoadEnvOptions {
	packageRoot?: string;
	explicitPath?: string;
	layers?: readonly EnvLayer[];
	target?: NodeJS.ProcessEnv;
}

export function loadEnvChain(
	options: LoadEnvOptions = {},
): Record<string, string> {
	const {
		packageRoot = packageRootDefault,
		explicitPath,
		layers = DEFAULT_LAYERS,
		target,
	} = options;

	const resolve = (candidate: string): string =>
		path.isAbsolute(candidate)
			? candidate
			: path.resolve(packageRoot, candidate);

	// An explicit DOTENV_CONFIG_PATH is an opt-in override (matches the
	// previous behavior and what callers who set it would expect).
	const effective: readonly EnvLayer[] = explicitPath
		? [{ file: explicitPath, override: true }]
		: layers;

	const merged: Record<string, string> = {};

	for (const { file, override } of effective) {
		const result = dotenv.config({
			path: resolve(file),
			override,
			processEnv: target,
		});
		if (result.parsed) {
			Object.assign(merged, result.parsed);
		}
	}

	return merged;
}
