import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRegion } from "@/components/ui/skeleton-blocks";
import { ExpertiseAskPanel } from "./components/ExpertiseAskPanel";
import { MemberGraphCanvas } from "./components/MemberGraphCanvas";
import { MemberGraphControls } from "./components/MemberGraphControls";
import { MemberGraphInspector } from "./components/MemberGraphInspector";
import { useExpertiseQuery } from "./hooks/useExpertiseQuery";
import { useMemberGraph } from "./hooks/useMemberGraph";

export default function MembersExpertiseGraphPage(): React.ReactElement {
	const {
		graph,
		isLoading,
		error,
		reasonKinds,
		setReasonKinds,
		showAlumni,
		setShowAlumni,
		selectedId,
		setSelectedId,
		selectedNode,
		compact,
		isolatedCount,
	} = useMemberGraph();

	const expertise = useExpertiseQuery();

	const nameByUserId = useMemo(
		() => new Map(graph.nodes.map((node) => [node.id, node.label])),
		[graph.nodes],
	);

	if (isLoading) {
		return <ExpertiseGraphSkeleton />;
	}

	if (error) {
		return (
			<div className="py-16 text-center">
				<p className="text-destructive">
					Failed to load the member graph. Please try again later.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">Expertise Graph</h1>
				<p className="mt-1 max-w-2xl text-muted-foreground">
					Explore how members cluster by shared attributes, and ask the graph in
					plain language who has a given expertise. Answers highlight matching
					members on the graph.
				</p>
			</header>

			<MemberGraphControls
				reasonKinds={reasonKinds}
				onReasonKindsChange={setReasonKinds}
				showAlumni={showAlumni}
				onShowAlumniChange={setShowAlumni}
				stats={{
					members: graph.nodes.length,
					shownEdges: graph.edges.length,
					logicalEdges: graph.logicalEdgeCount,
					components: graph.componentCount,
					largestComponent: graph.largestComponentSize,
					isolated: isolatedCount,
				}}
			/>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="space-y-4 lg:col-span-8">
					<MemberGraphCanvas
						graph={graph}
						compact={compact}
						selectedId={selectedId}
						onSelectedIdChange={setSelectedId}
						highlightIds={expertise.highlightIds}
						scoreByUserId={expertise.scoreByUserId}
					/>
					<MemberGraphInspector
						graph={graph}
						selectedNode={selectedNode}
						onSelectNode={setSelectedId}
					/>
				</div>
				<div className="lg:col-span-4">
					<div className="lg:sticky lg:top-4">
						<ExpertiseAskPanel
							question={expertise.question}
							onQuestionChange={expertise.setQuestion}
							onSubmit={expertise.submit}
							onClear={expertise.clear}
							isPending={expertise.isPending}
							answer={expertise.answer}
							source={expertise.source}
							rankedMatches={expertise.rankedMatches}
							hasResult={expertise.hasResult}
							nameByUserId={nameByUserId}
							onSelectMatch={setSelectedId}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function ExpertiseGraphSkeleton(): React.ReactElement {
	return (
		<SkeletonRegion label="Loading expertise graph">
			<div className="space-y-6">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-[32rem] max-w-full" />
				</div>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<Skeleton key={i} className="h-14 rounded-lg" />
					))}
				</div>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
					<Skeleton className="h-[440px] rounded-xl lg:col-span-8 md:h-[560px]" />
					<Skeleton className="h-[440px] rounded-xl lg:col-span-4" />
				</div>
			</div>
		</SkeletonRegion>
	);
}
