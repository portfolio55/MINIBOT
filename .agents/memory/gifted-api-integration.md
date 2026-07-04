---
name: Gifted API integration notes
description: How to correctly call the Gifted API (api.gifted.co.ke) - real domain, auth, and quirks discovered by probing since the public docs page only shows example endpoints, not the full 1200+ list.
---

## Correct domain and auth
- Real base URL: `https://api.gifted.co.ke` (NOT `api.giftedtech.co.ke` or `api.giftedtech.web.id` - those are wrong/legacy domains that appear in some copy-pasted bot code and silently fail or 404).
- Auth: `apikey` query param (GET) or body field (POST). Free test key: `gifted`.

**Why:** Several commands in this codebase were built by copying old GiftedTech snippets pointing at the wrong domain, so they looked correctly "wired to Gifted" but were actually calling dead/wrong hosts.

## Endpoint param names are inconsistent - verify empirically
The Gifted docs page (`/docs`) only renders a curated set of example endpoints, not the full catalog (site claims 1,210+ endpoints). For endpoints not shown in the docs, param names must be discovered by trial: a `400 "Query parameter cannot be blank"` response means the endpoint exists but you used the wrong param name; a `404` HTML page means the endpoint path itself doesn't exist.

Confirmed working endpoints/params (as of 2026-07-04):
- `/api/ai/ai?apikey=&q=` - AI chat
- `/api/tools/ttp?apikey=&query=` - text-to-picture (static image). No animated `attp` equivalent exists on Gifted.
- `/api/tools/fancyv2?apikey=&text=` - fancy fonts
- `/api/ephoto360/advancedglow?apikey=&text=` - glow text effect image
- `/api/tools/createqr?apikey=&query=` - QR code (returns image/png directly)
- `/api/tools/ssweb?apikey=&url=` - website screenshot (returns image/png directly)
- `/api/search/google?apikey=&query=` - Google search results (title/link/description) - useful as a generic fallback data source for lookup-style commands (movies, games, car specs, exercises) when Gifted has no dedicated endpoint for that domain
- `/api/search/lyrics?apikey=&query=`
- `/api/search/weather?apikey=&location=`
- Gifted has NO dedicated endpoints for: movie/OMDb-style lookup, game/RAWG-style lookup, artist/Last.fm-style lookup, car specs, TTS, exercise database, or news headlines - don't assume these exist without probing first.

**How to apply:** Before wiring a new Gifted endpoint, curl it directly with the free `gifted` key and inspect the status code/param error rather than trusting docs examples or old bot code.
