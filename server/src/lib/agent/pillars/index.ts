// Pillar registration. Adding a new pillar = author its descriptor (a `Pillar`
// with tools and/or a `knowledgeRoot` of markdown) and register it here — no
// changes to the orchestrator or registry are needed.

import type { PillarRegistry } from "../types.js";
import { membersPillar } from "./members.js";

let registered = false;

export function registerAllPillars(registry: PillarRegistry): void {
	if (registered) return;
	registry.register(membersPillar);
	registered = true;
}
