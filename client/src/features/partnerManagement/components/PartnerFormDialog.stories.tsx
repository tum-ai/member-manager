import type { CreatePartnerInput, PartnerTier } from "@member-manager/shared";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type React from "react";
import { useForm } from "react-hook-form";
import { expect, fn, userEvent, within } from "storybook/test";
import { PartnerFormDialog } from "./PartnerFormDialog";

const tier: PartnerTier = {
	id: "8b8e1d6c-9c50-4f1e-9a3a-2a8a5e1b1c11",
	slug: "silver",
	displayName: "Silver",
	hasCvAccess: true,
	jobQuota: 2,
	eventQuota: {},
	displayOrder: 2,
};

function PartnerFormDialogStory({ onSubmit }: { onSubmit: () => void }) {
	const form = useForm<CreatePartnerInput>({
		defaultValues: {
			companyName: "",
			primaryEmail: "",
			tierId: tier.id,
			contractStart: "2026-08-01",
			contractEnd: "2027-07-31",
			partnerKind: "tier_subscriber",
			websiteUrl: "",
			notes: "",
		},
	});
	const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
		event?.preventDefault();
		onSubmit();
	};
	return (
		<PartnerFormDialog
			open
			onOpenChange={() => {}}
			partner={null}
			tiers={[tier]}
			form={form}
			onSubmit={handleSubmit}
			isSaving={false}
		/>
	);
}

const meta = {
	title: "Partner Management/Partner Form Dialog",
	component: PartnerFormDialogStory,
	args: { onSubmit: fn() },
} satisfies Meta<typeof PartnerFormDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
	play: async ({ canvasElement, args }) => {
		const body = within(canvasElement.ownerDocument.body);
		await userEvent.type(body.getByLabelText(/company name/i), "Example GmbH");
		await userEvent.click(body.getByRole("button", { name: "Create partner" }));
		await expect(args.onSubmit).toHaveBeenCalledOnce();
	},
};
