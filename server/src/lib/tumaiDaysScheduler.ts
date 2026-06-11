import { isActiveMember } from "@member-manager/shared";
import { getAuthEmails } from "./authEmails.js";
import {
	lookupSlackUserIdByEmail,
	postDirectMessage,
} from "./slackNotifier.js";
import { getSupabase } from "./supabase.js";

interface Logger {
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

export async function sendPendingTumaiDayMessages(
	log?: Logger,
): Promise<number> {
	const logger = log ?? console;
	const now = new Date().toISOString();

	// 1. Fetch pending unsent events scheduled for now or in the past
	const { data: pendingEvents, error: eventsError } = await getSupabase()
		.from("tumai_days")
		.select("*")
		.is("sent_at", null)
		.lte("scheduled_at", now);

	if (eventsError) {
		logger.error(eventsError, "Scheduler failed to fetch pending events");
		return 0;
	}

	if (!pendingEvents || pendingEvents.length === 0) {
		return 0;
	}

	logger.info(
		`Scheduler found ${pendingEvents.length} pending TUM.ai Day event(s)`,
	);

	// 2. Fetch all members
	const { data: members, error: membersError } = await getSupabase()
		.from("members")
		.select("user_id, given_name, surname, active, member_status");

	if (membersError) {
		logger.error(membersError, "Scheduler failed to fetch members");
		return 0;
	}

	// Filter active members
	let activeMembers = (members ?? []).filter(isActiveMember);
	const activeUserIds = activeMembers.map((m) => m.user_id);

	if (activeUserIds.length === 0) {
		logger.warn("No active members found to send RSVP message to");
		return 0;
	}

	// 3. Resolve active member emails
	const emailMap = await getAuthEmails(activeUserIds);

	// Recipients are restricted to a configured list: TEST_RSVP_EMAIL (a single
	// test recipient) takes precedence over RSVP_TARGET_EMAILS (comma-separated).
	// With neither set, nothing is sent and events stay pending until configured.
	const testEmail = process.env.TEST_RSVP_EMAIL?.trim().toLowerCase();
	const envTargetEmails = (process.env.RSVP_TARGET_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	const targetEmails = testEmail ? [testEmail] : envTargetEmails;

	if (targetEmails.length === 0) {
		logger.warn(
			"Neither RSVP_TARGET_EMAILS nor TEST_RSVP_EMAIL is configured; leaving pending TUM.ai Day events unsent",
		);
		return 0;
	}

	activeMembers = activeMembers.filter((member) => {
		const email = emailMap.get(member.user_id)?.trim().toLowerCase();
		return email && targetEmails.includes(email);
	});

	// Bail out before claiming any event (which sets sent_at) when the configured
	// target list resolves to no active member. Otherwise the events would be
	// marked sent without a single DM going out, and no future cron run would
	// ever pick them up again.
	if (activeMembers.length === 0) {
		logger.warn(
			"No active members matched the configured RSVP target list; leaving pending TUM.ai Day events unsent",
		);
		return 0;
	}

	logger.info(
		testEmail
			? `[TEST MODE] Restricting RSVP messages to only "${testEmail}". Target member count: ${activeMembers.length}`
			: `Restricting RSVP messages to ${activeMembers.length} target member(s) from the target list.`,
	);

	let totalSent = 0;

	for (const event of pendingEvents) {
		// Claim the event (set sent_at) before sending so an overlapping cron run
		// or a retry after a mid-loop crash cannot DM the same members twice.
		const { data: claimed, error: claimError } = await getSupabase()
			.from("tumai_days")
			.update({ sent_at: new Date().toISOString() })
			.eq("id", event.id)
			.is("sent_at", null)
			.select();

		if (claimError) {
			logger.error(claimError, `Failed to claim event ${event.id} for sending`);
			continue;
		}
		if (!claimed || claimed.length === 0) {
			logger.info(`Event ${event.id} was already claimed by another run`);
			continue;
		}

		logger.info(`Sending RSVP message for TUM.ai Day event ${event.id}`);

		for (const member of activeMembers) {
			const email = emailMap.get(member.user_id);
			if (!email) {
				logger.warn(`No email found for active user ${member.user_id}`);
				continue;
			}

			try {
				// Lookup Slack User ID by email
				const slackUserId = await lookupSlackUserIdByEmail(email);
				if (!slackUserId) {
					logger.warn(`Could not resolve Slack User ID for email ${email}`);
					continue;
				}

				// Build Block Kit message
				const givenName = member.given_name || "Member";
				const blocks: Array<Record<string, unknown>> = [];

				blocks.push(
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `Hi ${givenName},\n\nHere is a reminder about the upcoming *TUM.ai Day*!`,
						},
					},
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `*Agenda:*\n${event.agenda}`,
						},
					},
					{
						type: "actions",
						block_id: `tumai_day_${event.id}_rsvp`,
						elements: [
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "Yes",
								},
								value: event.id,
								action_id: "tumai_day_rsvp_yes",
								style: "primary",
							},
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "No",
								},
								value: event.id,
								action_id: "tumai_day_rsvp_no",
								style: "danger",
							},
						],
					},
				);

				// Send DM
				await postDirectMessage(
					slackUserId,
					`Upcoming TUM.ai Day! Agenda: ${event.agenda}`,
					blocks,
				);
				totalSent++;
			} catch (error) {
				logger.error(
					error,
					`Failed to send TUM.ai Day Slack message to ${email}`,
				);
			}
		}
	}

	return totalSent;
}
