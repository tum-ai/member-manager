export type RotationOptions = {
	apply: boolean;
	plaintextOnly: boolean;
};

export function parseRotationOptions(args: string[]): RotationOptions {
	const supportedArgs = new Set(["--apply", "--plaintext-only"]);
	const unknownArg = args.find((arg) => !supportedArgs.has(arg));
	if (unknownArg) {
		throw new Error(`Unknown argument: ${unknownArg}`);
	}
	return {
		apply: args.includes("--apply"),
		plaintextOnly: args.includes("--plaintext-only"),
	};
}

export function requiresPrimaryVerification(options: RotationOptions): boolean {
	return !options.plaintextOnly;
}
