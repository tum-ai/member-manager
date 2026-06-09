import { isActiveMember } from "@member-manager/shared";
import { getAuthEmails } from "./authEmails.js";
import {
	lookupSlackUserIdByEmail,
	postDirectMessage,
} from "./slackNotifier.js";
import { getSupabase } from "./supabase.js";

export async function sendPendingTumaiDayMessages(
	log?: unknown,
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
	let activeUserIds = activeMembers.map((m) => m.user_id);

	if (activeUserIds.length === 0) {
		logger.warn("No active members found to send RSVP message to");
		return 0;
	}

	// 3. Resolve active member emails
	const emailMap = await getAuthEmails(activeUserIds);

	// Target filter (e.g. from Victor's list).
	// If either the env var RSVP_TARGET_EMAILS is set (comma-separated) or you define emails in the array below,
	// the RSVP scheduler will only send to those people.
	// Otherwise, it falls back to only sending to you (with a safety warning).
	const hardcodedTargetEmails: string[] = [
		// Add emails here to restrict sends directly in the code (e.g., "victor@example.com")
	];

	const envTargetEmails = process.env.RSVP_TARGET_EMAILS
		? process.env.RSVP_TARGET_EMAILS.split(",")
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean)
		: [];

	let targetEmails = [
		...hardcodedTargetEmails.map((e) => e.trim().toLowerCase()),
		...envTargetEmails,
	];
	let isFallbackMode = false;

	if (targetEmails.length === 0) {
		const fallbackEmail = (
			process.env.TEST_RSVP_EMAIL || "ketatasayf4@gmail.com"
		)
			.trim()
			.toLowerCase();
		targetEmails = [fallbackEmail];
		isFallbackMode = true;
	}

	// FOR TESTING: Filter to only a specific test email if process.env.TEST_RSVP_EMAIL is set
	const testEmail = process.env.TEST_RSVP_EMAIL;
	if (testEmail) {
		activeMembers = activeMembers.filter((member) => {
			const email = emailMap.get(member.user_id);
			return email?.trim().toLowerCase() === testEmail.trim().toLowerCase();
		});
		activeUserIds = activeMembers.map((m) => m.user_id);
		logger.info(
			`[TEST MODE] Restricting RSVP messages to only "${testEmail}". Target member count: ${activeMembers.length}`,
		);
	} else {
		activeMembers = activeMembers.filter((member) => {
			const email = emailMap.get(member.user_id)?.trim().toLowerCase();
			return email && targetEmails.includes(email);
		});
		activeUserIds = activeMembers.map((m) => m.user_id);
		if (isFallbackMode) {
			logger.warn(
				`[SAFETY TRIGGER] No target email list provided. Fallback mode activated: sending ONLY to fallback email "${targetEmails[0]}"`,
			);
		} else {
			logger.info(
				`Restricting RSVP messages to ${activeMembers.length} target member(s) from the target list.`,
			);
		}
	}

	let totalSent = 0;

	for (const event of pendingEvents) {
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
				const blocks: unknown[] = [];

				if (isFallbackMode) {
					blocks.push({
						type: "section",
						text: {
							type: "mrkdwn",
							text: `⚠️ *SAFETY WARNING:* The target email list was empty. This message was sent *only* to you as a fallback and was NOT sent to the rest of the community.`,
						},
					});
				}

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

		// 4. Mark the event as sent in the DB
		const { error: updateError } = await getSupabase()
			.from("tumai_days")
			.update({ sent_at: new Date().toISOString() })
			.eq("id", event.id);

		if (updateError) {
			logger.error(updateError, `Failed to mark event ${event.id} as sent`);
		}
	}

	return totalSent;
}
