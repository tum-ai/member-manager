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
				aliases: ["project-a", "Alpha Research", "alpha-research"],
			},
		]);
	});

	test("adds aliases for Sanity-backed research projects", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify([
					{
						_id: "N4SbQ8230skgGtiVXbepkg",
						title: "IBM Almaden: Sycophancy in LMs",
						desc: "Current Sanity project",
						status: "ongoing",
						image: "",
						publication: "",
						keywords: "",
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
				id: "N4SbQ8230skgGtiVXbepkg",
				title: "IBM Almaden: Sycophancy in LMs",
				description: "Current Sanity project",
				image: "",
				publication: "",
				status: "ongoing",
				keywords: "",
				aliases: [
					"N4SbQ8230skgGtiVXbepkg",
					"IBM Almaden: Sycophancy in LMs",
					"ibm-almaden-sycophancy-in-lms",
				],
			},
		]);
	});

	test("accepts null optional fields from Sanity", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify([
					{
						_id: "XNCTBM8X9vP2N4tjVzgEV2",
						title: "TUM CAMP: Long-Form Surgical Video Understanding",
						desc: null,
						status: null,
						image: null,
						publication: null,
						keywords: null,
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
				id: "XNCTBM8X9vP2N4tjVzgEV2",
				title: "TUM CAMP: Long-Form Surgical Video Understanding",
				description: "",
				image: "",
				publication: "",
				status: "",
				keywords: "",
				aliases: [
					"XNCTBM8X9vP2N4tjVzgEV2",
					"TUM CAMP: Long-Form Surgical Video Understanding",
					"tum-camp-long-form-surgical-video-understanding",
				],
			},
		]);
	});

	test("accepts omitted optional fields from Sanity", async () => {
		globalThis.fetch = async () =>
			new Response(
				JSON.stringify([
					{
						_id: "sanity-project-with-minimal-fields",
						title: "Minimal Sanity Project",
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
				id: "sanity-project-with-minimal-fields",
				title: "Minimal Sanity Project",
				description: "",
				image: "",
				publication: "",
				status: "",
				keywords: "",
				aliases: [
					"sanity-project-with-minimal-fields",
					"Minimal Sanity Project",
					"minimal-sanity-project",
				],
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
