import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ExpertiseAskPanel } from "./ExpertiseAskPanel";

const nameByUserId = new Map([
	["ada", "Ada Lovelace"],
	["ben", "Ben Board"],
]);

const meta = {
	title: "Features/Members/ExpertiseAskPanel",
	component: ExpertiseAskPanel,
	parameters: { layout: "padded" },
	args: {
		question: "",
		onQuestionChange: fn(),
		onSubmit: fn(),
		onClear: fn(),
		onSelectMatch: fn(),
		isPending: false,
		answer: null,
		source: null,
		rankedMatches: [],
		hasResult: false,
		nameByUserId,
	},
	render: (args) => (
		<div className="max-w-sm">
			<ExpertiseAskPanel {...args} />
		</div>
	),
} satisfies Meta<typeof ExpertiseAskPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Ask" }));
		await expect(args.onSubmit).toHaveBeenCalled();
	},
};

export const WithResults: Story = {
	args: {
		question: "Who knows machine learning?",
		answer: "**Ada** and Ben both work on machine learning.",
		source: "llm",
		hasResult: true,
		rankedMatches: [
			{ userId: "ada", score: 0.92, reason: "Matched: machine-learning, nlp" },
			{ userId: "ben", score: 0.55, reason: "Matched: machine-learning" },
		],
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const match = canvas.getByRole("button", { name: /Ada Lovelace/ });
		await userEvent.click(match);
		await expect(args.onSelectMatch).toHaveBeenCalledWith("ada");
	},
};

export const KeywordFallback: Story = {
	args: {
		question: "backend",
		answer: "Found 1 member related to backend: Ben Board.",
		source: "fallback",
		hasResult: true,
		rankedMatches: [{ userId: "ben", score: 0.4, reason: "Matched: backend" }],
	},
};
