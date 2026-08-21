import type {
	ContractCommentInput,
	ContractSignatureInput,
	PublicContractPartnerComment,
} from "@member-manager/shared";
import type { UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/features/contracts/SignaturePad";

export function PublicSigningConfirmation({
	children,
}: {
	children: string;
}): JSX.Element {
	return (
		<Alert tabIndex={-1} aria-live="polite">
			<AlertDescription>{children}</AlertDescription>
		</Alert>
	);
}

export function PublicContractCommentsSection({
	comments,
}: {
	comments: PublicContractPartnerComment[];
}): JSX.Element | null {
	if (comments.length === 0) return null;
	return (
		<Card className="p-5 sm:p-6">
			<h2 className="mb-3 text-lg font-semibold">Comments</h2>
			<div className="flex flex-col gap-4">
				{comments.map((item, index) => (
					<div
						key={`${item.created_at}-${item.author_type}-${item.author_name ?? ""}-${item.comment}`}
					>
						{index > 0 ? <Separator className="mb-4" /> : null}
						<p className="text-xs text-muted-foreground">
							{item.author_type === "partner"
								? (item.author_name ?? "Partner")
								: (item.author_name ?? "TUM.ai")}{" "}
							<span aria-hidden="true">·</span>{" "}
							{new Date(item.created_at).toLocaleString()}
						</p>
						<p className="mt-1 whitespace-pre-wrap">{item.comment}</p>
					</div>
				))}
			</div>
		</Card>
	);
}

export function PublicSignatureForm({
	form,
	title,
	description,
	submitLabel,
	submitting,
	error,
	onSignatureChange,
	onSubmit,
}: {
	form: UseFormReturn<ContractSignatureInput>;
	title: string;
	description: string;
	submitLabel: string;
	submitting: boolean;
	error: Error | null;
	onSignatureChange: (dataUrl: string | null) => void;
	onSubmit: (values: ContractSignatureInput) => void;
}): JSX.Element {
	return (
		<Card className="p-5 sm:p-6">
			<h2 className="text-lg font-semibold">{title}</h2>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			<Form {...form}>
				<form
					className="mt-5 flex flex-col gap-4"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<FormField
						control={form.control}
						name="signer_name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Full name</FormLabel>
								<FormControl>
									<Input autoComplete="name" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="signature_data"
						render={() => (
							<FormItem>
								<FormLabel>Signature</FormLabel>
								<SignaturePad onChange={onSignatureChange} />
								<FormMessage />
							</FormItem>
						)}
					/>
					{error ? (
						<Alert variant="destructive">
							<AlertDescription>{error.message}</AlertDescription>
						</Alert>
					) : null}
					<Button className="self-start" type="submit" disabled={submitting}>
						{submitting ? "Submitting…" : submitLabel}
					</Button>
				</form>
			</Form>
		</Card>
	);
}

export function PublicCommentForm({
	form,
	submitting,
	error,
	onSubmit,
}: {
	form: UseFormReturn<ContractCommentInput>;
	submitting: boolean;
	error: Error | null;
	onSubmit: (values: ContractCommentInput) => void;
}): JSX.Element {
	return (
		<Card className="p-5 sm:p-6">
			<h2 className="text-lg font-semibold">Have questions before signing?</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				Send your questions or requested changes to TUM.ai instead of signing.
			</p>
			<Form {...form}>
				<form
					className="mt-5 flex flex-col gap-4"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<FormField
						control={form.control}
						name="comment"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Your message</FormLabel>
								<FormControl>
									<Textarea rows={4} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					{error ? (
						<Alert variant="destructive">
							<AlertDescription>{error.message}</AlertDescription>
						</Alert>
					) : null}
					<Button
						type="submit"
						variant="outline"
						className="self-start"
						disabled={submitting}
					>
						{submitting ? "Sending…" : "Send message"}
					</Button>
				</form>
			</Form>
		</Card>
	);
}

export function PartnerSignatureSummary({
	signerName,
	signedAt,
	signatureData,
}: {
	signerName: string | null;
	signedAt: string | null;
	signatureData: string;
}): JSX.Element {
	return (
		<Card className="p-5 sm:p-6">
			<h2 className="text-lg font-semibold">Partner signature</h2>
			<p className="mt-1 text-sm">
				<span className="text-muted-foreground">Signed by </span>
				<span className="font-medium">{signerName || "Partner"}</span>
				{signedAt ? (
					<span className="text-muted-foreground">
						{" "}
						on {new Date(signedAt).toLocaleString()}
					</span>
				) : null}
			</p>
			<img
				src={signatureData}
				alt={`Signature of ${signerName || "the partner"}`}
				className="mt-3 max-h-32 w-auto rounded-md border border-border/60 bg-white p-2"
			/>
		</Card>
	);
}
