import { Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/GlassCard";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	fromSelectValue,
	NONE_VALUE,
	toSelectValue,
} from "@/features/profile/profileUtils";
import type { MemberChangeRequest } from "@/hooks/useMemberChangeRequests";
import { DEPARTMENTS, MEMBER_ROLES } from "@/lib/constants";
import { SectionHeading } from "./SectionHeading";

interface RoleChangeRequestSectionProps {
	requestedRole: string;
	setRequestedRole: (value: string) => void;
	requestedDepartment: string;
	setRequestedDepartment: (value: string) => void;
	isRequestingAlumniStatus: boolean;
	setIsRequestingAlumniStatus: (value: boolean) => void;
	changeRequestReason: string;
	setChangeRequestReason: (value: string) => void;
	latestMemberChangeRequest: MemberChangeRequest | undefined;
	isSubmittingChangeRequest: boolean;
	onSubmitMemberChangeRequest: () => void;
	ids: {
		requestedRole: string;
		requestedDepartment: string;
		alumniCheckbox: string;
		reason: string;
	};
}

export function RoleChangeRequestSection({
	requestedRole,
	setRequestedRole,
	requestedDepartment,
	setRequestedDepartment,
	isRequestingAlumniStatus,
	setIsRequestingAlumniStatus,
	changeRequestReason,
	setChangeRequestReason,
	latestMemberChangeRequest,
	isSubmittingChangeRequest,
	onSubmitMemberChangeRequest,
	ids,
}: RoleChangeRequestSectionProps): JSX.Element {
	return (
		<GlassCard id="requests" variant="elevated" className="scroll-mt-20">
			<CardContent className="p-6">
				<SectionHeading
					icon={Send}
					title="Request role, department, or status changes"
					description="Send a request to the admin and LnF team for review."
				/>

				<div className="grid grid-cols-1 gap-4">
					<Field label="Requested role" htmlFor={ids.requestedRole}>
						<Select
							value={toSelectValue(requestedRole)}
							onValueChange={(value) =>
								setRequestedRole(fromSelectValue(value))
							}
						>
							<SelectTrigger
								id={ids.requestedRole}
								className="w-full"
								aria-label="Requested role"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>No change</SelectItem>
								{MEMBER_ROLES.map((role) => (
									<SelectItem key={role} value={role}>
										{role}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field
						label="Requested department"
						htmlFor={ids.requestedDepartment}
						description="Department changes are reviewed by an admin."
					>
						<Select
							value={toSelectValue(requestedDepartment)}
							onValueChange={(value) =>
								setRequestedDepartment(fromSelectValue(value))
							}
						>
							<SelectTrigger
								id={ids.requestedDepartment}
								className="w-full"
								aria-label="Requested department"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>No change</SelectItem>
								{DEPARTMENTS.map((department) => (
									<SelectItem key={department} value={department}>
										{department}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div>
						<div className="flex items-center gap-1">
							<div className="flex items-center gap-2">
								<Checkbox
									id={ids.alumniCheckbox}
									checked={isRequestingAlumniStatus}
									onCheckedChange={(checked) =>
										setIsRequestingAlumniStatus(checked === true)
									}
								/>
								<Label htmlFor={ids.alumniCheckbox}>
									Request alumni status
								</Label>
							</div>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label="Alumni status request information"
										>
											<Info className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										Alumni requests are eligible after two active semesters and
										are reviewed by Legal & Finance.
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
					<Field label="Reason" htmlFor={ids.reason}>
						<Textarea
							id={ids.reason}
							value={changeRequestReason}
							onChange={(event) => setChangeRequestReason(event.target.value)}
							rows={3}
							placeholder="Briefly explain why your role or status should change."
						/>
					</Field>
				</div>

				{latestMemberChangeRequest && (
					<div className="mt-5 rounded-lg bg-brand/5 p-4">
						<p className="mb-0.5 text-sm font-medium">
							Latest request:{" "}
							{latestMemberChangeRequest.status.charAt(0).toUpperCase() +
								latestMemberChangeRequest.status.slice(1)}
						</p>
						{latestMemberChangeRequest.reason && (
							<p className="text-sm text-muted-foreground">
								Reason: {latestMemberChangeRequest.reason}
							</p>
						)}
					</div>
				)}

				<Button
					type="button"
					variant="outline"
					onClick={onSubmitMemberChangeRequest}
					disabled={isSubmittingChangeRequest}
					className="mt-5"
				>
					{isSubmittingChangeRequest
						? "Submitting request..."
						: "Request changes"}
				</Button>
			</CardContent>
		</GlassCard>
	);
}
