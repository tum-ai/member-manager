// Pillar registration. Adding a new pillar = author its descriptor (a `Pillar`
// with tools and/or a `knowledgeRoot` of markdown) and register it here — no
// changes to the orchestrator or registry are needed.

import type { PillarRegistry } from "../types.js";
import { expertiseGraphPillar } from "./expertiseGraph.js";
import { membersPillar } from "./members.js";
import { orgPillar } from "./org.js";

// Per-registry guard so re-registration is idempotent without a single
// module-global flag: a fresh registry (e.g. in tests) initializes on its own
// instead of being silently skipped because another registry registered first.
const initialized = new WeakSet<PillarRegistry>();

export function registerAllPillars(registry: PillarRegistry): void {
	if (initialized.has(registry)) return;
	registry.register(membersPillar);
	registry.register(orgPillar);
	registry.register(expertiseGraphPillar);
	initialized.add(registry);
}
