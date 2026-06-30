import type { RefusalActionResult, RefusalPayload } from './types';
import { SlackRefusalAction } from './slack-action';
import { LinearRefusalAction } from './linear-action';

/**
 * Orchestrates the configured refusal actions. Runs Linear first (so its ticket
 * url can be attached to the Slack message); Slack is suppressed when Linear
 * returned a dedup hit (created === false) — that means this refusal was already
 * filed on a prior run, so a CI re-run stays quiet. Never throws.
 */
export class RefusalDispatcher {
  constructor(
    private readonly slack: SlackRefusalAction | null,
    private readonly linear: LinearRefusalAction | null,
  ) {}

  async dispatch(payload: RefusalPayload): Promise<{ results: RefusalActionResult[] }> {
    const results: RefusalActionResult[] = [];
    let ticketUrl: string | undefined;
    let dedupHit = false;

    if (this.linear) {
      const r = await this.linear.notify(payload);
      results.push(r);
      ticketUrl = r.url;
      dedupHit = r.ok && r.created === false;
    }
    if (this.slack && !dedupHit) {
      results.push(await this.slack.notify({ ...payload, ticketUrl }));
    }
    return { results };
  }
}

/**
 * Build the dispatcher from env. No-op (no actions) unless configured:
 *   - SLACK_WEBHOOK_URL                     → Slack alert
 *   - LINEAR_API_KEY + LINEAR_TEAM_ID       → Linear ticket
 *     (LINEAR_PROJECT_ID, LINEAR_LABEL_ID optional)
 */
export function resolveRefusalDispatcher(opts: { fetchFn?: typeof fetch } = {}): RefusalDispatcher {
  const { fetchFn } = opts;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  const slack = webhookUrl ? new SlackRefusalAction({ webhookUrl, fetchFn }) : null;

  const apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  const linear =
    apiKey && teamId
      ? new LinearRefusalAction({
          apiKey,
          teamId,
          projectId: process.env.LINEAR_PROJECT_ID,
          labelId: process.env.LINEAR_LABEL_ID,
          fetchFn,
        })
      : null;

  return new RefusalDispatcher(slack, linear);
}
