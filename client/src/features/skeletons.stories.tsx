import type { Meta, StoryObj } from "@storybook/react-vite";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { AdminDatabaseSkeleton } from "./admin/AdminDatabaseView";
import { MemberListSkeleton } from "./members/MemberList";
import { OrgChartSkeleton } from "./members/MembersOrgChartPage";
import {
	InnovationSkeleton,
	ResearchSkeleton,
} from "./members/projectSections";
import { ProfilePageSkeleton } from "./profile/ProfilePage";

/**
 * Page-shaped loading skeletons. Each mirrors the real content layout it
 * stands in for, so the swap from skeleton to content is seamless.
 */
const meta = {
	title: "Skeletons/Page Skeletons",
	parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const MemberList: Story = {
	render: () => <MemberListSkeleton />,
};

export const AdminDatabase: Story = {
	render: () => <AdminDatabaseSkeleton />,
};

export const Profile: Story = {
	render: () => <ProfilePageSkeleton />,
};

export const OrgChart: Story = {
	render: () => <OrgChartSkeleton />,
};

export const Research: Story = {
	render: () => <ResearchSkeleton />,
};

export const Innovation: Story = {
	render: () => <InnovationSkeleton />,
};

export const Region: Story = {
	render: () => (
		<SkeletonRegion label="Loading" className="text-sm text-muted-foreground">
			SkeletonRegion wraps a page's skeleton and exposes a single role="status"
			with an sr-only label.
		</SkeletonRegion>
	),
};
