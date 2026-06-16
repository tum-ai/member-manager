import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { z } from "zod";
import {
	readKnowledgeFile,
	renderFileTree,
} from "../../src/lib/agent/knowledge.js";
import { createRegistry } from "../../src/lib/agent/registry.js";
import { defineTool, type Pillar } from "../../src/lib/agent/types.js";

function fakePillar(id: string, knowledgeRoot?: string): Pillar {
	return {
		id,
		title: `Pillar ${id}`,
		shortDescription: `short ${id}`,
		longDescription: `long ${id}`,
		knowledgeRoot,
		tools: [
			defineTool({
				name: `${id}_tool`,
				description: "demo",
				params: z.object({ q: z.string() }),
				handler: async () => ({ content: "ok" }),
			}),
		],
	};
}

test("registry: register / get / all", () => {
	const reg = createRegistry();
	reg.register(fakePillar("members"));
	assert.equal(reg.get("members")?.id, "members");
	assert.equal(reg.get("nope"), undefined);
	assert.deepEqual(
		reg.all().map((p) => p.id),
		["members"],
	);
});

test("registry: base tools always present (load_pillar, read_knowledge_file)", () => {
	const reg = createRegistry();
	const names = reg.baseTools().map((t) => t.name);
	assert.ok(names.includes("load_pillar"));
	assert.ok(names.includes("read_knowledge_file"));
});

test("registry: activeTools grows only after a pillar is loaded", () => {
	const reg = createRegistry();
	reg.register(fakePillar("members"));
	const loaded = new Set<string>();
	const before = reg.activeTools(loaded).map((t) => t.name);
	assert.ok(!before.includes("members_tool"));
	loaded.add("members");
	const after = reg.activeTools(loaded).map((t) => t.name);
	assert.ok(after.includes("members_tool"));
	assert.equal(reg.activeTool(loaded, "members_tool")?.name, "members_tool");
	assert.equal(reg.activeTool(new Set(), "members_tool"), undefined);
});

test("knowledge: file tree lists only .md/.txt; sandbox rejects traversal + non-md", () => {
	const root = mkdtempSync(join(tmpdir(), "beacon-knowledge-"));
	mkdirSync(join(root, "sub"));
	writeFileSync(join(root, "process.md"), "# Process\nHello");
	writeFileSync(join(root, "sub", "limits.txt"), "limits");
	writeFileSync(join(root, "secret.json"), "{}");

	const tree = renderFileTree(root);
	assert.ok(tree.includes("process.md"));
	assert.ok(tree.includes("sub/limits.txt"));
	assert.ok(!tree.includes("secret.json"));

	assert.equal(readKnowledgeFile(root, "process.md"), "# Process\nHello");
	assert.throws(() => readKnowledgeFile(root, "../../etc/passwd"), /escapes/);
	assert.throws(() => readKnowledgeFile(root, "secret.json"), /\.md and \.txt/);
});
