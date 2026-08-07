import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import ContractFormPage from "./ContractFormPage";

vi.mock("@/hooks/useCurrentUserIsAdmin", () => ({
	useCurrentUserIsAdmin: () => ({
		currentUserId: "user-1",
		isAdmin: true,
		isLoading: false,
	}),
}));

const TEMPLATE_ID = "10000000-0000-4000-8000-000000000001";

function template(contractTextEn: string | null) {
	return {
		id: TEMPLATE_ID,
		name: "Long-Term Partnership",
		description: null,
		contract_text: "Deutscher Vertrag für {{partner_company_name}}",
		contract_text_en: contractTextEn,
		is_active: true,
		created_at: "2026-08-01T00:00:00Z",
		updated_at: "2026-08-01T00:00:00Z",
	};
}

/** Records every preview/submission body the page sends. */
function mockContractApi(contractTextEn: string | null) {
	const previews: Array<Record<string, unknown>> = [];
	const submissions: Array<Record<string, unknown>> = [];

	server.use(
		http.get("/api/contracts/templates", () =>
			HttpResponse.json([template(contractTextEn)]),
		),
		http.get(`/api/contracts/templates/${TEMPLATE_ID}`, () =>
			HttpResponse.json({
				template: template(contractTextEn),
				variables: [],
				blocks: [],
			}),
		),
		http.post(
			`/api/contracts/templates/${TEMPLATE_ID}/preview`,
			async (info) => {
				previews.push((await info.request.json()) as Record<string, unknown>);
				return HttpResponse.json({
					text: "",
					html: "",
					pages: ["<p>page</p>"],
				});
			},
		),
		http.post("/api/contracts/submissions", async (info) => {
			submissions.push((await info.request.json()) as Record<string, unknown>);
			return HttpResponse.json({ id: "submission-1" });
		}),
	);

	return { previews, submissions };
}

function renderPage() {
	return renderWithClient(
		<MemoryRouter>
			<ContractFormPage />
		</MemoryRouter>,
	);
}

describe("ContractFormPage language switch", () => {
	it("sends the picked language with the preview and the submission", async () => {
		const { previews, submissions } = mockContractApi("English contract");
		renderPage();

		const english = await screen.findByRole("radio", { name: "English" });
		expect(english).toBeEnabled();
		await userEvent.click(english);

		await waitFor(() =>
			expect(
				previews.some(
					(body) =>
						(body.form_data as Record<string, unknown>)?.contract_language ===
						"en",
				),
			).toBe(true),
		);

		await userEvent.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(submissions).toHaveLength(1));
		expect(
			(submissions[0].form_data as Record<string, unknown>).contract_language,
		).toBe("en");
	});

	it("keeps German and disables English without a translation", async () => {
		const { previews, submissions } = mockContractApi(null);
		renderPage();

		expect(
			await screen.findByRole("radio", { name: "English" }),
		).toBeDisabled();

		await userEvent.click(screen.getByRole("button", { name: "Submit" }));

		await waitFor(() => expect(submissions).toHaveLength(1));
		expect(
			(submissions[0].form_data as Record<string, unknown>).contract_language,
		).toBeUndefined();
		expect(
			previews.every(
				(body) =>
					(body.form_data as Record<string, unknown>)?.contract_language ===
					undefined,
			),
		).toBe(true);
	});
});
