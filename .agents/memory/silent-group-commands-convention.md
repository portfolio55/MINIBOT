---
name: Silent group command response convention
description: The user-confirmed feedback style for bot commands (reaction vs text, no quoting) — apply consistently to any new/edited command.
---

Convention for command responses in this WhatsApp bot, confirmed by the user:

- **Success** (an action was performed, e.g. kick/mute/lock/save/toggle-on-off): react to the triggering message with `sock.sendMessage(from, { react: { text: "✅", key: msg.key } })`. Do not also send a text confirmation.
- **Error / invalid state / permission denied**: send a plain text message describing the problem.
- **Never quote the original command message** — do not pass `{ quoted: msg }` (or `{ quoted: m }`) to any `sock.sendMessage` call in command handlers.
- **Content-delivery commands** (the reply IS the requested info/media — e.g. `.gclink`, `.infosgroups`, status-query with no args, `.vv`/`.vv2`/`.save` media output): keep sending the actual content as text/media, just without quoting. Only add a reaction once delivery genuinely succeeds if there's no natural content response.

**Why:** user explicitly requested a quieter experience — confirmations should not clutter the chat, only reactions should signal success, and replies should not visually tie back to the command via WhatsApp's quote/reply UI.

**How to apply:** when adding or editing any command handler, follow this pattern by default unless the user asks for a different style. As of 2026-07-05, ~115 non-group commands still use `{ quoted: msg }`; these were left untouched (mostly legitimate content-delivery commands) but user may ask to normalize them too.
