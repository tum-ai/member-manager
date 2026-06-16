// Read-only, sandboxed access to a pillar's knowledge directory. Used by the
// `read_knowledge_file` base tool. Only `.md`/`.txt`, only within the pillar's
// root (no traversal), capped in size.

import { type Dirent, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const MAX_FILE_BYTES = 100_000;
const ALLOWED_EXT = [".md", ".txt"];

const allowed = (name: string): boolean =>
	ALLOWED_EXT.some((ext) => name.toLowerCase().endsWith(ext));

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
	const target = resolve(abs, rel);
	if (target !== abs && !target.startsWith(abs + sep))
		throw new Error("path escapes the knowledge directory");
	if (!allowed(target)) throw new Error("only .md and .txt files can be read");
	const st = statSync(target);
	if (!st.isFile()) throw new Error("not a file");
	if (st.size > MAX_FILE_BYTES) throw new Error("file too large");
	return readFileSync(target, "utf8");
}
