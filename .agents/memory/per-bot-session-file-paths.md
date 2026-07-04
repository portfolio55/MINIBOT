---
name: Per-bot session file paths
description: Why a per-bot file feature (audio, media, config) can silently fail even though the file was saved successfully.
---

Some per-bot features write a file into the bot's isolated session directory (`sessions/bot_<UUID>/...`) but the code that later reads that file back uses a hardcoded project-root path instead of the same session path.

**Why:** `commands/setrespons.js` saves the custom audio reply to `sessionPath/respon.mp3` (correctly isolated per bot), but `protections2.js`'s `sendAudioResponse()` read from `process.cwd()/respon.mp3` (project root) regardless of which bot triggered it — so the file it just saved was never found by the runtime listener, even though `initProtections()`'s own startup existence-check used the correct session path. The bug pattern (a listener/consumer disagreeing with the writer about the storage location) is the same class of bug as per-bot cache splitting.

**How to apply:** For any new per-bot file feature, grep for every place that builds a path to that file and make sure `sessionPath` (from `bot.sessionPath` / `botContext.sessionPath`) is threaded through consistently — the writer, the reader/listener, and any status-check function must all resolve to the exact same path. Never hardcode `process.cwd()` or a bare filename for per-bot data; only use it as a fallback when sessionPath is genuinely unavailable (e.g. legacy single-bot mode).
