import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ContractSignatureInput,
	SignBodySchema,
} from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";
import { expect, fn, userEvent, within } from "storybook/test";
import { PublicSignatureForm } from "./PublicSigningSections";

function SignatureFormStory({
	onSubmit,
	onSignatureChange,
}: {
	onSubmit: (values: ContractSignatureInput) => void;
	onSignatureChange: (value: string | null) => void;
}): JSX.Element {
	const form = useForm<ContractSignatureInput>({
		resolver: zodResolver(SignBodySchema),
		defaultValues: { signer_name: "", signature_data: "" },
	});
	return (
		<div className="mx-auto max-w-2xl">
			<PublicSignatureForm
				form={form}
				title="Sign the contract"
				description="Enter your full name and draw or upload your signature."
				submitLabel="Sign contract"
				submitting={false}
				error={null}
				onSignatureChange={(value) => {
					form.setValue("signature_data", value ?? "", {
						shouldValidate: true,
					});
					onSignatureChange(value);
				}}
				onSubmit={onSubmit}
			/>
		</div>
	);
}

const meta = {
	title: "Contracts/PublicSignatureForm",
	component: SignatureFormStory,
	parameters: { layout: "padded", a11y: { test: "error" } },
	args: { onSubmit: fn(), onSignatureChange: fn() },
} satisfies Meta<typeof SignatureFormStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UploadSignature: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(canvas.getByLabelText("Full name"), "Jane Partner");
		await userEvent.upload(
			canvas.getByLabelText("Upload PNG"),
			new File(["png"], "signature.png", { type: "image/png" }),
		);
		await expect(args.onSignatureChange).toHaveBeenCalled();
		await userEvent.click(
			canvas.getByRole("button", { name: "Sign contract" }),
		);
		await expect(args.onSubmit).toHaveBeenCalled();
	},
};
