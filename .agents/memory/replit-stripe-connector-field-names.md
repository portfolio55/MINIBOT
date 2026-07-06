---
name: Replit Stripe connector field names
description: Actual JSON field names returned by the Replit connector API for Stripe, which differ from the stripe skill's code-templates.md
---

The Replit connector API (`GET /api/v2/connection?include_secrets=true&connector_names=stripe`)
returns `settings.secret` and `settings.publishable` (not `secret_key`/`publishable_key` as
shown in `.local/skills/stripe/references/code-templates.md`). The webhook signing secret, if
present, lives under `webhook_config` on the connection item, not under `settings`.

**Why:** Following the template's field names verbatim (`settings.secret_key`) causes
`getStripeCredentials()` to silently think the integration isn't connected, throwing "missing
secret key" even though the connection is healthy. This cost a full debug cycle.

**How to apply:** Before trusting any Replit connector template's field names, fetch the
connection once (e.g. via `listConnections` in code_execution or a direct authenticated fetch)
and log `Object.keys(item.settings)` to confirm actual field names for that connector before
wiring `stripeClient.js`-style credential fetchers.
