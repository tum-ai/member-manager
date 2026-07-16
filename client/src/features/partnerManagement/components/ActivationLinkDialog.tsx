import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ActivationLinkDialogProps {
	activation: {
		companyName: string;
		link: string;
		emailSent: boolean;
	} | null;
	onOpenChange: (open: boolean) => void;
	onCopy: () => void;
}

export function ActivationLinkDialog({
	activation,
	onOpenChange,
	onCopy,
}: ActivationLinkDialogProps) {
	return (
		<Dialog open={!!activation} onOpenChange={(open) => onOpenChange(open)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Activation link</DialogTitle>
					<DialogDescription>
						{activation?.emailSent ? (
							<span className="inline-flex items-center gap-1.5">
								<Check className="size-4 text-emerald-600" />
								Email sent to {activation.companyName}. Keep this link as a
								backup.
							</span>
						) : (
							`Share this one-time link with ${activation?.companyName ?? "the partner"}.`
						)}
					</DialogDescription>
				</DialogHeader>
				<Input
					readOnly
					aria-label="Activation link"
					value={activation?.link ?? ""}
					onFocus={(event) => event.currentTarget.select()}
				/>
				<DialogFooter>
					<Button
						className="bg-[#9A64D9] text-white hover:bg-[#523573]"
						onClick={onCopy}
					>
						<Copy />
						Copy link
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
