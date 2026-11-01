/**
 * The `error` the API sends (with HTTP 401) when a valid session belongs to
 * someone outside the TUM.ai Slack workspace. The client matches on it to
 * explain why it signed the user out.
 */
export const SLACK_WORKSPACE_NOT_ALLOWED_ERROR = "Slack workspace not allowed";
