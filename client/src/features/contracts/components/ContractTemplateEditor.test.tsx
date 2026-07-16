import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ContractTemplateEditorViewModel } from "@/features/contracts/contractTemplatesPageTypes";
import { TemplateEditor } from "./ContractTemplateEditor";

describe("TemplateEditor", () => {
	it("renders query errors instead of an indefinite loading skeleton", () => {
		const model = {
			detail: undefined,
			draft: null,
			loading: false,
			error: new Error("Template could not be loaded"),
		} as ContractTemplateEditorViewModel;

		render(<TemplateEditor model={model} />);

		expect(
			screen.getByText("Template could not be loaded"),
		).toBeInTheDocument();
		expect(screen.queryByLabelText("Loading template")).not.toBeInTheDocument();
	});
});
