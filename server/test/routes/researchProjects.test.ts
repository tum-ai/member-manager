import "../setup.js";
import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import {
	authHeaders,
	closeTestApp,
	getTestApp,
	testTokens,
} from "../helpers.js";

describe("Research Project Routes", async () => {
	let app: FastifyInstance;
	const originalFetch = globalThis.fetch;

	before(async () => {
		app = await getTestApp();
	});

	after(async () => {
		globalThis.fetch = originalFetch;
		await closeTestApp();
	});

	test("returns normalized research projects from the website API", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify([
					{
						id: "project-a",
						title: " Alpha Research ",
						description: " Current project ",
						status: "ongoing",
						image: "",
						publication: "",
						keywords: "AI",
					},
				]),
				{ status: 200, headers: { "content-type": "application/json" } },
			);

		const response = await app.inject({
			method: "GET",
			url: "/api/research-projects",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(response.payload), [
			{
				id: "project-a",
				title: "Alpha Research",
				description: "Current project",
				image: "",
				publication: "",
				status: "ongoing",
				keywords: "AI",
			},
		]);
	});

	test("returns innovation projects mirrored from the website data", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/innovation-projects",
			headers: authHeaders(testTokens.user),
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(JSON.parse(response.payload)[0], {
			id: "women-at-tum-ai",
			title: "Women@TUM.ai",
			description:
				"Female empowerment, mentorship, and leadership across AI, business, and tech.",
			detailedDescription:
				"Women@TUM.ai builds a space where female students in AI, business, and tech can connect, grow, and take initiative. The task force focuses on empowerment, leadership, mentorship, workshops, networking, and industry collaboration.",
			image: "/assets/innovation/women_at_tumai.jpg",
		});
	});

	test("requires authentication", async () => {
		const response = await app.inject({
			method: "GET",
			url: "/api/research-projects",
		});

		assert.strictEqual(response.statusCode, 401);
	});
});
