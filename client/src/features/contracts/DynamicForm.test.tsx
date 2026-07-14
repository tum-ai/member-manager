import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicForm, isValidEmailInput, isVisible } from "./DynamicForm";
import type { ContractTemplateVariable } from "@member-manager/shared";

function makeVariable(
	overrides: Partial<ContractTemplateVariable> = {},
): ContractTemplateVariable {
	return {
		id: "var-1",
		template_id: "tmpl-1",
		variable_name: "partner_contact_email",
		label: "Partner contact email",
		data_type: "EMAIL",
		help_text: null,
		options: null,
		is_required: true,
		is_multiselect: false,
		show_if_variable: null,
		show_if_value: null,
		sort_order: 0,
		...overrides,
	};
}

describe("isValidEmailInput", () => {
	it("accepts well-formed addresses", () => {
		expect(isValidEmailInput("partner@example.com")).toBe(true);
		expect(isValidEmailInput("  partner@example.com  ")).toBe(true);
	});

	it("rejects malformed addresses", () => {
		expect(isValidEmailInput("not-an-email")).toBe(false);
		expect(isValidEmailInput("missing@tld")).toBe(false);
		expect(isValidEmailInput("two words@example.com")).toBe(false);
		expect(isValidEmailInput("@example.com")).toBe(false);
	});
});

describe("isVisible", () => {
	it("shows variables without a guard", () => {
		expect(isVisible(makeVariable(), {})).toBe(true);
	});

	it("hides variables whose guard value does not match", () => {
		const variable = makeVariable({
			show_if_variable: "has_addons",
			show_if_value: "yes",
		});
		expect(isVisible(variable, { has_addons: "no" })).toBe(false);
		expect(isVisible(variable, { has_addons: "yes" })).toBe(true);
	});
});

// EMAIL variables render as email inputs with an inline hint.
describe("DynamicForm EMAIL fields", () => {
	it("renders an email input for EMAIL variables", () => {
		render(
			<DynamicForm
				variables={[makeVariable()]}
				values={{ partner_contact_email: "partner@example.com" }}
				onChange={vi.fn()}
			/>,
		);

		expect(screen.getByText(/Partner contact email/)).toBeInTheDocument();
		expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
		expect(
			screen.queryByText("Enter a valid email address."),
		).not.toBeInTheDocument();
	});

	it("shows an inline hint for malformed addresses", () => {
		render(
			<DynamicForm
				variables={[makeVariable()]}
				values={{ partner_contact_email: "not-an-email" }}
				onChange={vi.fn()}
			/>,
		);

		expect(
			screen.getByText("Enter a valid email address."),
		).toBeInTheDocument();
		expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
	});

	it("does not flag empty values (required is handled separately)", () => {
		render(
			<DynamicForm
				variables={[makeVariable()]}
				values={{}}
				onChange={vi.fn()}
			/>,
		);

		expect(
			screen.queryByText("Enter a valid email address."),
		).not.toBeInTheDocument();
	});
});
