// Read-only, sandboxed access to a pillar's knowledge directory. Used by the
// `read_knowledge_file` base tool. Only `.md`/`.txt`, only within the pillar's
// root (no traversal), capped in size.

import {
	closeSync,
	constants,
	type Dirent,
	fstatSync,
	openSync,
	readdirSync,
	readFileSync,
	realpathSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const MAX_FILE_BYTES = 100_000;
const ALLOWED_EXT = [".md", ".txt"];

const allowed = (name: string): boolean =>
	ALLOWED_EXT.some((ext) => name.toLowerCase().endsWith(ext));

const isWithin = (root: string, target: string): boolean =>
	target === root || target.startsWith(root + sep);

// A flat, sorted listing of readable documents (relative POSIX paths).
export function renderFileTree(root: string): string {
	const abs = resolve(root);
	const lines: string[] = [];
	const walk = (dir: string): void => {
		let entries: Dirent[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
			const full = join(dir, e.name);
			if (e.isDirectory()) walk(full);
			else if (allowed(e.name))
				lines.push(relative(abs, full).split(sep).join("/"));
		}
	};
	walk(abs);
	return lines.length ? lines.join("\n") : "(no documents)";
}

// Read one document, enforcing the sandbox. Throws on traversal / wrong type /
// too large / missing.
export function readKnowledgeFile(root: string, rel: string): string {
	const abs = resolve(root);
	const lexicalTarget = resolve(abs, rel);
	if (!isWithin(abs, lexicalTarget))
		throw new Error("path escapes the knowledge directory");
	if (!allowed(lexicalTarget))
		throw new Error("only .md and .txt files can be read");

	const realRoot = realpathSync(abs);
	const target = realpathSync(lexicalTarget);
	if (!isWithin(realRoot, target))
		throw new Error("path escapes the knowledge directory");

	const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const st = fstatSync(fd);
		if (!st.isFile()) throw new Error("not a file");
		if (st.size > MAX_FILE_BYTES) throw new Error("file too large");
		return readFileSync(fd, "utf8");
	} finally {
		closeSync(fd);
	}
}
