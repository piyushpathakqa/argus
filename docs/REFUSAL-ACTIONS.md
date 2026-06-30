# Refusal actions — Slack + Linear (TRE-77)

When Vigilis **refuses to heal** a failing test — i.e. it triaged the failure as
a **real regression** (behaviour change), not selector drift — it can push that
event to where your team works: a **Slack alert** and an auto-filed **Linear
ticket**. Both are optional and **off by default**; with no config, nothing
happens. They fire **only** on a `real-bug` refusal, never on heals or flakes.

> Honesty note: a refusal is a **suspected** real regression. Attestation is
> verifiable and auditable — it records what the agent decided, not that the
> decision is correct. Every alert/ticket links the signed receipt so you can
> verify before acting.

## Enable

Set environment variables wherever the agent runs (locally or in CI):

| Variable | Enables | Notes |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Slack alert | A Slack [Incoming Webhook](https://api.slack.com/messaging/webhooks) URL (channel-bound). |
| `LINEAR_API_KEY` | Linear ticket | A Linear API key. Required with `LINEAR_TEAM_ID`. |
| `LINEAR_TEAM_ID` | Linear ticket | Target team id. |
| `LINEAR_PROJECT_ID` | — | Optional target project. |
| `LINEAR_LABEL_ID` | — | Optional label id to attach (e.g. a `vigilis-refusal` label you created). |

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/…"
export LINEAR_API_KEY="lin_api_…"
export LINEAR_TEAM_ID="…"          # optional: LINEAR_PROJECT_ID, LINEAR_LABEL_ID
vigilis heal --spec tests/checkout.spec.ts https://your-app.com
```

## Behaviour

- **Slack** posts a compact alert: the spec, repo, expected/actual (when known),
  the triage rationale, and the signed-receipt link.
- **Linear** is **idempotent**: it embeds a `vigilis-fingerprint: <hash>` marker
  in the ticket body and searches for an existing **open** ticket with that
  fingerprint before creating one. A CI re-run of the same refusal finds the
  open ticket and does **not** file a duplicate. (A previously *closed* ticket is
  treated as resolved — a recurrence files a new one.)
- **Slack + Linear together:** when both are configured, Slack stays quiet on a
  Linear dedup hit (the refusal was already filed), and the Slack message links
  the freshly-filed ticket when a new one is created.
- **Never breaks the run:** all network calls are best-effort with an 8s timeout;
  any failure is swallowed. A Slack/Linear outage cannot affect the gate.

## Fingerprint

The dedup id is `sha256(repo · spec · "real-bug" · expected · actual · rationale)`
(first 12 hex chars). It deliberately excludes the timestamp and receipt URL so
the same refusal across runs collapses to one ticket.
