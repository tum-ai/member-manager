import type { Meta, StoryObj } from "@storybook/react-vite";
import ContractDocumentPreview from "./ContractDocumentPreview";

// Mirror the server's page HTML: each paragraph is a <p> whose wrapped lines
// are joined by <br>, and paragraphs are separated by a counted blank line.
// The server budgets 39 such lines per page.
const para = (lines: string[]): string => `<p>${lines.join("<br>")}</p>`;
const blank = '<div class="blank-line">&nbsp;</div>';

const body = [
	"Das Partnerunternehmen verspricht sich von einer Unterstuetzung des AI E-Lab",
	"- im Folgenden Veranstaltung genannt - eine Erhoehung seines",
	"unternehmerischen Ansehens und ist an einer Einraeumung von",
	"Werbemoeglichkeiten interessiert. Das Partnerunternehmen hat sich daher",
	"bereit erklaert, durch finanzielle Zuwendungen die Ausrichtung dieser",
];

// Page one packed close to the 39-line budget (7 paragraphs of 5 lines + 6
// blank separators = 41 line-equivalents) to prove a full page keeps a bottom
// margin and never clips its last line.
const fullPage = Array.from({ length: 7 }, () => para(body)).join(blank);

const secondPage = [
	"<h2>§ 1 Vertragsgegenstand</h2>",
	blank,
	para([
		"Veranstaltung zu unterstuetzen. Zu diesem Zweck vereinbaren der Veranstalter",
		"und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:",
	]),
].join("");

const titlePage = [
	"<h1>KOOPERATIONSVERTRAG</h1>",
	blank,
	para(["zwischen TUM.ai e.V. und dem Partnerunternehmen."]),
	blank,
	fullPage,
].join("");

const meta = {
	title: "Contracts/ContractDocumentPreview",
	component: ContractDocumentPreview,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="h-screen overflow-hidden rounded-md border bg-card">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ContractDocumentPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultiPage: Story = {
	args: {
		pages: [titlePage, fullPage, secondPage],
		maxHeight: "100vh",
		minHeight: 400,
	},
};

export const SinglePage: Story = {
	args: {
		pages: [secondPage],
		maxHeight: "100vh",
		minHeight: 400,
	},
};

export const Loading: Story = {
	args: { loading: true },
};

export const Empty: Story = {
	args: { pages: [] },
};
