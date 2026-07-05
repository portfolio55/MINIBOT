---
name: Health-check restart must not set the permanent manual-stop flag
description: Internal auto-restarts (health check, watchdog) must use a non-permanent stop path, or bots get silently stranded forever after a transient false alarm.
---

In `src/botManager.js`, `stopBot(uuid)` sets a `bot._manuallyStopped` flag that permanently
blocks all future auto-reconnection logic. This flag is meant only for real admin/user-initiated
stops (and `deleteBot`).

**Why:** `restartBot()` (used by the health check when it thinks a socket is dead, and by the
reconnect watchdog) called the same `stopBot()` and therefore set the same permanent flag —
even though the "dead socket" was often a false positive (e.g. caused by a slow/stalled DB query
during simultaneous multi-bot reconnection after a redeploy, not an actual dead connection). Once
set, the bot would never reconnect again without manual DB/API intervention, silently breaking
users' bots hours or days after the transient blip that triggered it.

**How to apply:** `stopBot(uuid, manual = true)` now takes a `manual` parameter. Any code path
that stops a bot as part of an *internal* recovery/restart flow (health check, watchdog,
recovery sweep) must call `stopBot(uuid, false)` so `_manuallyStopped` is left untouched and the
bot remains eligible for automatic reconnection afterward. Only true manual/admin stop paths
(dashboard "stop" action, `deleteBot`) should use the default `manual = true`. When adding any
new internal auto-restart path, check it goes through `restartBot()` or explicitly passes
`manual=false` — never call `stopBot(uuid)` bare from automated recovery code.
