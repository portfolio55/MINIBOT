---
name: Per-bot groupManager cache must be a single shared instance
description: Why group protection toggles (welcome, antilink, antipromote, etc.) can silently fail to take effect even though they save correctly to the database.
---

Each bot has one in-memory group-protections cache, created via `createGroupManager(sessionPath)` in groupManager.js. Calling `createGroupManager()` again anywhere else creates a brand-new, independent cache that separately (re)loads from Postgres — writes to one instance are invisible to another until a full restart reloads everyone from the DB.

**Why:** Command files were independently calling `createGroupManager(botContext?.sessionPath)` on every invocation instead of reusing the bot's cache, while the actual event listeners (welcome/goodbye/antilink/etc. in protections.js) were reading from a separate cache created once at bot startup. Result: `.welcome on` persisted to the DB correctly, but the live `group-participants.update` listener never saw the change until the bot process restarted. One file (`antipromote.js`) had an even worse variant — it used the legacy *global* (cross-bot) cache from groupManager.js instead of any per-bot instance.

**How to apply:** There must be exactly one `groupManager` instance per bot (`bot.groupManager`, created in botManager.js). It must be threaded through: (1) passed into `initProtections(sock, ownerNumber, sessionPath, sharedGroupManager)` so event listeners read/write it, and (2) exposed on `botContext.groupManager` so every command handler uses `botContext?.groupManager || createGroupManager(...)` (fallback only for safety) instead of creating its own. When adding a new command that reads/writes group protections, always use `botContext.groupManager` — never call `createGroupManager()` directly inside command logic.
