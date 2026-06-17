import type { User } from "@supabase/supabase-js";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http, server } from "@/test/mswServer";
import { renderWithClient } from "@/test/renderWithClient";
import { MemberForm } from "./MemberForm";

const showToast = vi.fn();
vi.mock("../../contexts/ToastContext", () => ({
	useToast: () => ({ showToast }),
}));

vi.mock("../../lib/supabaseClient", () => ({
	supabase: {
		auth: {
			getSession: vi.fn().mockResolvedValue({
				data: { session: { access_token: "test-token" } },
			}),
			signOut: vi.fn(),
		},
	},
}));

const user = { id: "user-1", email: "ada@tum.ai" } as User;

function stubMember(overrides: Record<string, unknown> = {}) {
	server.use(
		http.get("/api/members/user-1", () =>
			HttpResponse.json({
				active: true,
				salutation: "Ms.",
				given_name: "Ada",
				surname: "Lovelace",
				email: "ada@tum.ai",
				street: "Main St",
				number: "1",
				postal_code: "80331",
				city: "Munich",
				country: "Germany",
				date_of_birth: "1990-01-01",
				...overrides,
			}),
		),
	);
}

function stubSepa(overrides: Record<string, unknown> = {}) {
	server.use(
		http.get("/api/sepa/user-1", () =>
			HttpResponse.json({
				iban: "DE89370400440532013000",
				bic: "COBADEFFXXX",
				bank_name: "Test Bank",
				mandate_agreed: false,
				privacy_agreed: false,
				data_privacy_notice_agreed: false,
				user_id: "user-1",
				...overrides,
			}),
		),
	);
}

describe("MemberForm", () => {
	beforeEach(() => {
		showToast.mockClear();
	});

	it("renders personal and banking sections once data loads", async () => {
		stubMember();
		stubSepa();
		renderWithClient(<MemberForm user={user} />);

		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: /personal information/i }),
			).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("heading", { name: /banking details/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/email/i)).toHaveValue("ada@tum.ai");
		expect(screen.getByText(/active member/i)).toBeInTheDocument();
	});

	it("blocks submit and shows validation errors when required fields are empty", async () => {
		const userEv = userEvent.setup();
		stubMember({ given_name: "", surname: "" });
		stubSepa({ iban: "", bank_name: "" });
		let memberPut = 0;
		let sepaPut = 0;
		server.use(
			http.put("/api/members/user-1", () => {
				memberPut += 1;
				return new HttpResponse(null, { status: 204 });
			}),
			http.put("/api/sepa/user-1", () => {
				sepaPut += 1;
				return HttpResponse.json({});
			}),
		);

		renderWithClient(<MemberForm user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /save changes/i }),
			).toBeInTheDocument(),
		);

		await userEv.click(screen.getByRole("button", { name: /save changes/i }));

		await waitFor(() =>
			expect(screen.getByText(/given name is required/i)).toBeInTheDocument(),
		);
		expect(screen.getByText(/surname is required/i)).toBeInTheDocument();
		// SEPA invalid, but the member half is also invalid so nothing is sent.
		expect(memberPut).toBe(0);
		expect(sepaPut).toBe(0);
	});

	it("submits both updates when forms are valid", async () => {
		const userEv = userEvent.setup();
		stubMember();
		stubSepa({
			mandate_agreed: true,
			privacy_agreed: true,
			data_privacy_notice_agreed: true,
		});
		let memberPut = 0;
		let sepaPut = 0;
		server.use(
			http.put("/api/members/user-1", () => {
				memberPut += 1;
				return new HttpResponse(null, { status: 204 });
			}),
			http.put("/api/sepa/user-1", () => {
				sepaPut += 1;
				return HttpResponse.json({});
			}),
		);

		renderWithClient(<MemberForm user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /save changes/i }),
			).toBeInTheDocument(),
		);

		await userEv.click(screen.getByRole("button", { name: /save changes/i }));

		await waitFor(() => expect(memberPut).toBe(1));
		expect(sepaPut).toBe(1);
		expect(showToast).toHaveBeenCalledWith(
			"Data saved successfully!",
			"success",
		);
	});

	it("requests a membership status change after confirmation", async () => {
		const userEv = userEvent.setup();
		stubMember();
		stubSepa();
		const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

		renderWithClient(<MemberForm user={user} />);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /change your membership status/i }),
			).toBeInTheDocument(),
		);

		await userEv.click(
			screen.getByRole("button", { name: /change your membership status/i }),
		);

		await waitFor(() =>
			expect(screen.getByText(/has been sent to finance/i)).toBeInTheDocument(),
		);
		expect(showToast).toHaveBeenCalledWith(
			"Status change request sent!",
			"info",
		);
		confirmSpy.mockRestore();
	});
});
