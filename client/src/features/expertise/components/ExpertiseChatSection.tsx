import {
	Building2,
	GraduationCap,
	ScrollText,
	SquarePen,
	Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { AgentLogSheet } from "@/features/expertise/AgentLogSheet";
import { Composer } from "@/features/expertise/Composer";
import ExpertiseProfilePage from "@/features/expertise/ExpertiseProfilePage";
import type { ExpertiseChatPageViewModel } from "@/features/expertise/hooks/useExpertiseChatPage";
import { PeoplePanel } from "@/features/expertise/PeoplePanel";
import { ChatMessageList } from "./ChatMessageList";

const SUGGESTIONS = [
	{ icon: Building2, text: "Who has worked at a big tech company?" },
	{ icon: GraduationCap, text: "Find someone with a US Ivy League degree" },
	{ icon: Users, text: "A senior iOS dev who shipped an App Store app" },
];

/** Presentational shell for the Beacon assistant workspace. */
export function ExpertiseChatSection({
	chat,
}: {
	chat: ExpertiseChatPageViewModel;
}): JSX.Element {
	const openProfile = (id: string, name: string) =>
		chat.setProfileTarget({ id, name });
	return (
		<div className="flex min-h-0 flex-1 bg-background text-foreground">
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				{chat.empty ? (
					<section
						className="flex flex-1 flex-col items-center justify-center px-4 py-10"
						aria-labelledby="beacon-welcome"
					>
						<h2
							id="beacon-welcome"
							className="mb-8 text-center text-2xl font-semibold tracking-tight sm:text-3xl"
						>
							Good to see you, {chat.firstName}.
						</h2>
						<div className="w-full max-w-2xl">
							<Composer
								onSubmit={chat.runConversation}
								disabled={chat.busy}
								autoFocus
							/>
						</div>
						<div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
							{SUGGESTIONS.map(({ icon: Icon, text }) => (
								<Button
									key={text}
									type="button"
									variant="outline"
									size="sm"
									disabled={chat.busy}
									onClick={() => chat.runConversation(text, [])}
									className="h-auto rounded-full py-2 text-muted-foreground"
								>
									<Icon className="size-4" />
									<span className="whitespace-normal text-left">{text}</span>
								</Button>
							))}
						</div>
					</section>
				) : (
					<>
						<div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/85 px-3 py-2 backdrop-blur">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={chat.clearChat}
								className="rounded-full"
							>
								<SquarePen className="size-3.5" /> New chat
							</Button>
							<div className="flex items-center gap-1.5">
								{chat.isAdmin ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => chat.setLogOpen(true)}
										className="rounded-full"
									>
										<ScrollText className="size-3.5" /> Log
									</Button>
								) : null}
								{chat.mentionedPeople.length > 0 && !chat.peopleOpen ? (
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => chat.setPeopleOpen(true)}
										aria-label={`Show ${chat.mentionedPeople.length} referenced people`}
										className="relative rounded-full"
									>
										<Users className="size-[18px]" />
										<span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
											{chat.mentionedPeople.length}
										</span>
									</Button>
								) : null}
							</div>
						</div>
						<div
							ref={chat.scrollRef}
							className="min-h-0 flex-1 overflow-y-auto"
						>
							<div className="mx-auto max-w-3xl px-4 pb-6 pt-6">
								<ChatMessageList
									messages={chat.messages}
									onOpenProfile={openProfile}
									onRegenerate={(query) => chat.runConversation(query, [])}
									onCopy={chat.copyMessage}
								/>
								<div ref={chat.endRef} />
							</div>
						</div>
						<div className="mx-auto w-full max-w-3xl px-4 pb-4">
							<Composer onSubmit={chat.runConversation} disabled={chat.busy} />
							<p className="mt-2 text-center text-[11px] text-muted-foreground">
								Results may include <strong>Unverified</strong> claims. Verify
								important details.
							</p>
						</div>
					</>
				)}
			</div>

			{chat.mentionedPeople.length > 0 && chat.peopleOpen ? (
				<PeoplePanel
					people={chat.mentionedPeople}
					onOpen={openProfile}
					onClose={() => chat.setPeopleOpen(false)}
				/>
			) : null}
			{chat.isAdmin ? (
				<AgentLogSheet
					chatId={chat.chatId}
					open={chat.logOpen}
					onOpenChange={chat.setLogOpen}
				/>
			) : null}
			<Sheet
				open={Boolean(chat.profileTarget)}
				onOpenChange={(open) => {
					if (!open) chat.setProfileTarget(null);
				}}
			>
				<SheetContent
					side="right"
					className="w-full gap-0 overflow-y-auto bg-background p-0 sm:max-w-2xl"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>{chat.profileTarget?.name ?? "Profile"}</SheetTitle>
					</SheetHeader>
					{chat.profileTarget ? (
						<div className="p-4 sm:p-6">
							<ExpertiseProfilePage
								user={chat.user}
								userId={chat.profileTarget.id}
							/>
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
