import { Link } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import type { ProfileFormValues } from "@/features/profile/profileFormModel";
import {
	isLinkedinProfileUrl,
	normalizeLinkedinProfileUrl,
} from "@/lib/linkedin";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";

interface LinksSectionProps {
	ids: {
		linkedinUrl: string;
		publicLocation: string;
	};
}

export function LinksSection({ ids }: LinksSectionProps): JSX.Element {
	const form = useFormContext<ProfileFormValues>();
	const linkedinUrl = useWatch({
		control: form.control,
		name: "linkedin_profile_url",
	});
	const normalizedLinkedinUrl = normalizeLinkedinProfileUrl(linkedinUrl);
	const isLinkedinUrlValid = isLinkedinProfileUrl(linkedinUrl);
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
						error={form.formState.errors.linkedin_profile_url?.message}
					>
						<div className="relative">
							<Input
								id={ids.linkedinUrl}
								placeholder="https://linkedin.com/in/your-profile"
								{...form.register("linkedin_profile_url")}
								aria-invalid={!!form.formState.errors.linkedin_profile_url}
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
							{...form.register("public_location")}
						/>
					</Field>
				</div>
			</CardContent>
		</GlassCard>
	);
}
