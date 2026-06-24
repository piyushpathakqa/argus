# Governance Cloud — Audit Dashboard MVP — Design

> **Date:** 2026-06-24 · **Linear:** epic **TRE-54** (sub-issues TRE-62→66, billing TRE-67→70).
> The first paid feature of the open-core governance cloud (see `docs/PRICING.md`).
> **Status:** design — ready to build once the cloud's repo location + accounts (Postgres / auth / Stripe) are chosen.

## Goal & smallest sellable cut

A hosted service that aggregates an org's heal/refusal receipts into one **signed, searchable, exportable audit trail.**

**Smallest sellable cut:** sign in → create an org → generate an API key → point the agent at it (`VIGILIS_CLOUD_KEY`) → see your org's heals & refusals → export them. That alone is payable.

## Architecture (open-core boundary)

```
OSS agent (this repo, MIT)            Governance Cloud (separate, paid)
  heal / refuse → Treeship receipt
  CloudReporter.report(CloudReceipt) ───POST /api/ingest (Bearer key)──▶  ingest API
                                                                          │
                                                                          ▼
                                                              Postgres (orgs, keys, receipts)
                                                                          │
                                                                          ▼
                                                          dashboard UI · export · retention · Stripe
```

- The agent already emits a `CloudReceipt` via the optional reporter (**TRE-61, shipped**) — no key = no-op. The cloud only *consumes* it. The MIT core never depends on the cloud.
- The cloud is a **separate service** with its own DB / auth / Stripe. Location TBD (monorepo `apps/cloud` vs private `vigilis-cloud` repo — a commercial/branding call).

## The ingest contract (already fixed by TRE-61)

`POST /api/ingest`, `Authorization: Bearer <org api key>`, body = `CloudReceipt`:
```ts
{ specPath, url, verdict, healed, rationale?, suggestedSelector?, framework?, repo?, receiptId?, receiptUrl?, timestamp }
```
- **Idempotent** on `(orgId, receiptId || hash(specPath,url,timestamp))` — re-sends don't duplicate.
- Auth: look up the org by API key (hashed at rest); reject unknown/revoked keys (401).
- Enforce the org's **repo limit** (entitlement) at ingest — over limit → 402/accepted-but-flagged + upgrade nudge.

## Data model (Postgres)

- **org** — id, name, created_at, plan (`free|team|enterprise`), stripe_customer_id, stripe_subscription_id
- **user** — id, email, auth provider id; **org_member** — (org_id, user_id, role `admin|member|viewer`)
- **api_key** — id, org_id, name, key_hash, last_used_at, revoked_at
- **receipt** — id, org_id, repo, spec_path, url, verdict, healed (bool), rationale, suggested_selector, framework, receipt_id, receipt_url, created_at, ingested_at  · indexes on (org_id, created_at), (org_id, repo), (org_id, verdict)

## Surfaces (→ tickets)

| Area | Ticket | Scope |
|---|---|---|
| Service scaffold | TRE-62 | Next.js app, Postgres (Neon/Vercel), auth wiring, deploy |
| Org / auth / API keys | TRE-63 | sign-in, org model + roles, key create/revoke UI |
| Ingest API + model | TRE-64 | `/api/ingest` (above), idempotent, key-auth |
| Dashboard UI | TRE-65 | receipt list + filter/search (repo·verdict·date·spec), detail → Treeship verify link |
| Compliance export | TRE-66 | filtered CSV/JSON export (PDF later) |
| Stripe + portal | TRE-67 | Team plan $149 + $25/repo add-on, checkout, billing portal, webhooks |
| Entitlements | TRE-68 | Stripe sub → repo limit / retention / feature flags (single source of truth) |
| Retention | TRE-69 | prune by tier (14d free / 1y team / unlimited ent) + roll-off messaging |
| Free taste + upgrade prompts | TRE-70 | 1 repo, 14d, no export; upgrade nudges at each wall |

## Tech choices (the to-confirm decisions)

Recommended, all free-tier to start: **Next.js** (App Router) · **Postgres** (Neon via Vercel marketplace) · **Auth.js** (email + GitHub OAuth) · **Stripe** (test mode) · deploy on **Vercel**. None of these block scaffolding — a local Postgres/SQLite + stub auth gets the ingest→dashboard loop working before real accounts exist.

## Build order (MVP → first dollar)

1. Scaffold (TRE-62) → 2. Org/auth/API keys (TRE-63) → 3. Ingest API (TRE-64) → 4. Dashboard list/detail (TRE-65) → 5. Export (TRE-66). **← sellable demo here.** Then 6. Stripe (TRE-67) → 7. Entitlements (TRE-68) → 8. Retention (TRE-69) → 9. Free limits + nudges (TRE-70).

## Acceptance (MVP)

- A configured agent (`VIGILIS_CLOUD_KEY`) → heals/refusals appear in the org's dashboard within seconds, deduped.
- Filter/search works; each receipt links to its Treeship verify page.
- Export produces a clean CSV/JSON of the filtered trail.
- No key / no cloud → the OSS agent behaves exactly as today (TRE-61 guarantees this).
- The MIT core has zero dependency on the cloud (boundary grep clean).

## Open decisions (need Piyush/Revaz)

1. Cloud location: separate private repo vs `apps/cloud`; under Zerker brand?
2. Accounts: who owns Stripe / Postgres / auth provider.
3. Validate pricing (TRE-60) before wiring real Stripe prices.
