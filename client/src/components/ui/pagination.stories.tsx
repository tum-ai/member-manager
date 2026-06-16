import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";

const meta = {
	title: "UI/Pagination",
	component: Pagination,
	tags: ["autodocs"],
	parameters: { layout: "centered" },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [page, setPage] = useState(2);
		const pages = [1, 2, 3];

		return (
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							href="#"
							onClick={(event) => {
								event.preventDefault();
								setPage((current) => Math.max(1, current - 1));
							}}
						/>
					</PaginationItem>
					{pages.map((value) => (
						<PaginationItem key={value}>
							<PaginationLink
								href="#"
								isActive={value === page}
								onClick={(event) => {
									event.preventDefault();
									setPage(value);
								}}
							>
								{value}
							</PaginationLink>
						</PaginationItem>
					))}
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
					<PaginationItem>
						<PaginationLink
							href="#"
							isActive={page === 10}
							onClick={(event) => {
								event.preventDefault();
								setPage(10);
							}}
						>
							10
						</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationNext
							href="#"
							onClick={(event) => {
								event.preventDefault();
								setPage((current) => Math.min(10, current + 1));
							}}
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		);
	},
};
