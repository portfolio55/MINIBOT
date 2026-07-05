---
name: Interactive command reply interception
description: Pattern for commands (like .play) that need a bare numeric/text reply with no prefix, e.g. "1"/"2" menu choices.
---

Commands sometimes need a follow-up reply from the user that has no command prefix (e.g. replying "1" or "2" to a menu). These replies won't pass the normal prefix check in the message handler, so they must be intercepted earlier.

**How to apply:** in `src/botManager.js`'s `handleMessages()`, add an interception check right after the message text is extracted but before the prefix/config loading logic. Keep a module-level `Map` inside the command file itself (keyed by `uuid:chatJid:senderJid`, with a TTL/timeout to auto-expire), and export a `handlePendingXReply(uuid, from, sender, text)` function from that command module that the bot manager calls first. If it returns `true`, the message was consumed as a reply and normal command routing is skipped.

**Why:** keeps the stateful "pending choice" logic colocated with the command that owns it (e.g. `commands/play.js`) instead of scattering per-command state across `botManager.js`, while still letting botManager gate all incoming messages centrally.
