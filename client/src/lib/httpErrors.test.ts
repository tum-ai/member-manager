import { describe, expect, it } from "vitest";
import { readJsonErrorMessage } from "./httpErrors";

describe("readJsonErrorMessage", () => {
	it("uses JSON error fields when present", async () => {
		const response = new Response(
			JSON.stringify({ error: "Invalid request" }),
			{
				status: 400,
				statusText: "Bad Request",
				headers: { "content-type": "application/json" },
			},
		);

		await expect(readJsonErrorMessage(response)).resolves.toBe(
			"Invalid request",
		);
	});

	it("falls back when a JSON response body cannot be parsed", async () => {
		const response = new Response("not json", {
			status: 502,
			statusText: "Bad Gateway",
			headers: { "content-type": "application/json" },
		});

		await expect(readJsonErrorMessage(response)).resolves.toBe("Bad Gateway");
	});
});
