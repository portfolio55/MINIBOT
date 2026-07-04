---
name: Baileys git dependency firewall block
description: Why npm install fails for WhatsApp Baileys packages/forks on Replit, and the fix.
---

Replit's npm package firewall (package-firewall.replit.local) blocks tarball downloads for
packages whose declared `package.json` includes a git-URL dependency (e.g. `libsignal:
git+https://github.com/.../libsignal-node.git`) or transitively pulls in packages flagged
for critical CVEs (old `form-data`, `protobufjs@6.8.8` via `libsignal-node`, `request`-based
scrapers like `google-it`/`weather-js`/`node-gtts`).

This affects the official `@whiskeysockets/baileys` package on versions <7.0.0 (git-based
libsignal dependency) and any community forks (e.g. `@zeppeliorg/wbails`) built on top of it —
overriding the nested `libsignal` dependency via npm `overrides` does NOT help, because the
firewall blocks the fetch of the *parent* package's tarball itself before override resolution
even applies.

**Why:** The security policy inspects each package's declared dependencies at fetch time and
rejects tarballs that reference git URLs or known-vulnerable transitive packages, regardless
of what `overrides` say downstream.

**How to apply:** Use `@whiskeysockets/baileys@^7.0.0-rc13` or later — as of the 7.0.0 RC line,
Baileys switched its `libsignal` dependency to the npm-published `libsignal@^6.0.0` package
(no git URL), which installs cleanly. Also add `overrides` for `form-data@^4.0.0` and
`protobufjs@^7.5.6` if other transitive deps pull in older vulnerable versions. Verify no
fork-specific APIs are used (check imports across the codebase) before swapping a fork back to
the official package.
