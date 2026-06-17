import { Link } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GlassCard } from "../../../components/ui/GlassCard";
import type { LinkedinSchema } from "../../../lib/schemas";
import { SectionHeading } from "./SectionHeading";

interface LinksSectionProps {
	linkedinForm: UseFormReturn<LinkedinSchema>;
	isLinkedinUrlValid: boolean;
	normalizedLinkedinUrl: string;
	ids: {
		linkedinUrl: string;
		publicLocation: string;
	};
}

export function LinksSection({
	linkedinForm,
	isLinkedinUrlValid,
	normalizedLinkedinUrl,
	ids,
}: LinksSectionProps): JSX.Element {
	return (
		<GlassCard id="links" variant="elevated" className="scroll-mt-20">
			<CardContent className="p-6">
				<SectionHeading
					icon={Link}
					title="LinkedIn & location"
					description="This data is visible to other TUM.ai members."
				/>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field
						className="sm:col-span-2"
						label="LinkedIn Profile URL"
						htmlFor={ids.linkedinUrl}
						error={linkedinForm.formState.errors.linkedin_profile_url?.message}
					>
						<div className="relative">
							<Input
								id={ids.linkedinUrl}
								placeholder="https://linkedin.com/in/your-profile"
								{...linkedinForm.register("linkedin_profile_url")}
								aria-invalid={
									!!linkedinForm.formState.errors.linkedin_profile_url
								}
								className={cn(isLinkedinUrlValid && "pr-10")}
							/>
							{isLinkedinUrlValid && (
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									asChild
									className="absolute top-1/2 right-1 -translate-y-1/2 text-brand"
								>
									<a
										href={normalizedLinkedinUrl}
										aria-label="View LinkedIn profile"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Link className="size-4" />
									</a>
								</Button>
							)}
						</div>
					</Field>

					<Field
						label="Public location"
						htmlFor={ids.publicLocation}
						description="Shown on your member profile; separate from your address."
					>
						<Input
							id={ids.publicLocation}
							placeholder="Munich, Germany"
							{...linkedinForm.register("public_location")}
						/>
					</Field>
				</div>
			</CardContent>
		</GlassCard>
	);
}
