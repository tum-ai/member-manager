// Pillar registry + the always-available base tools. `load_pillar` activates a
// pillar's tools and reveals its long description + knowledge tree;
// `read_knowledge_file` reads a doc from a loaded pillar (sandboxed).

import { z } from "zod";
import { readKnowledgeFile, renderFileTree } from "./knowledge.js";
import {
	defineTool,
	type Pillar,
	type PillarRegistry,
	type PillarTool,
} from "./types.js";

function baseTools(): PillarTool[] {
	return [
		defineTool({
			name: "load_pillar",
			description:
				"Load a pillar to activate its tools and reveal its knowledge. Call this before using a pillar's capabilities.",
			params: z.object({
				pillar_id: z
					.string()
					.describe("The id of the pillar to load (see the catalog)."),
			}),
			handler: async ({ pillar_id }, ctx) => {
				const pillar = ctx.registry.get(pillar_id);
				if (!pillar) {
					const ids = ctx.registry
						.all()
						.map((p) => p.id)
						.join(", ");
					return {
						content: `Unknown pillar "${pillar_id}". Available: ${ids}.`,
					};
				}
				ctx.loadedPillars.add(pillar.id);
				ctx.emit({
					type: "pillar_loaded",
					pillar_id: pillar.id,
					tools: pillar.tools.map((t) => t.name),
				});
				const toolList =
					pillar.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n") ||
					"(no tools)";
				const tree = pillar.knowledgeRoot
					? `\n\nKnowledge documents (read with read_knowledge_file):\n${renderFileTree(
							pillar.knowledgeRoot,
						)}`
					: "";
				return {
					content: `Loaded "${pillar.title}". ${pillar.longDescription}\n\nTools now available:\n${toolList}${tree}`,
				};
			},
		}),
		defineTool({
			name: "read_knowledge_file",
			description:
				"Read a knowledge document from a loaded pillar's library (relative path from its knowledge root).",
			params: z.object({
				pillar_id: z.string(),
				path: z.string().describe("Relative path, e.g. 'process.md'."),
			}),
			handler: async ({ pillar_id, path }, ctx) => {
				const pillar = ctx.registry.get(pillar_id);
				if (!pillar) return { content: `Unknown pillar "${pillar_id}".` };
				if (!ctx.loadedPillars.has(pillar_id))
					return { content: `Load the "${pillar_id}" pillar first.` };
				if (!pillar.knowledgeRoot)
					return {
						content: `Pillar "${pillar_id}" has no knowledge documents.`,
					};
				try {
					return { content: readKnowledgeFile(pillar.knowledgeRoot, path) };
				} catch (e) {
					return {
						content: `Could not read "${path}": ${
							e instanceof Error ? e.message : "error"
						}`,
					};
				}
			},
		}),
	];
}

class Registry implements PillarRegistry {
	private pillars = new Map<string, Pillar>();
	private readonly base = baseTools();

	register(p: Pillar): void {
		this.pillars.set(p.id, p);
	}
	get(id: string): Pillar | undefined {
		return this.pillars.get(id);
	}
	all(): Pillar[] {
		return [...this.pillars.values()];
	}
	baseTools(): PillarTool[] {
		return this.base;
	}
	activeTools(loaded: Set<string>): PillarTool[] {
		const out = [...this.base];
		for (const id of loaded) {
			const p = this.pillars.get(id);
			if (p) out.push(...p.tools);
		}
		return out;
	}
	activeTool(loaded: Set<string>, name: string): PillarTool | undefined {
		return this.activeTools(loaded).find((t) => t.name === name);
	}
}

// A fresh, isolated registry (used by tests).
export function createRegistry(): PillarRegistry {
	return new Registry();
}

// Module-level singleton; pillars register into it via registerAllPillars().
export const registry: PillarRegistry = new Registry();
