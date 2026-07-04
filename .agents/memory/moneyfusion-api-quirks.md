---
name: MoneyFusion (FusionPay) API quirks
description: Real-world reachability and endpoint-path corrections discovered for the MoneyFusion payment API, differing from what docs/config initially assumed.
---

- The merchant's payment-creation URL (`MONEYFUSION_API_URL`, format `https://pay.moneyfusion.net/{AppName}/{key}/pay/`) works fine over `pay.moneyfusion.net`, but the `www.pay.moneyfusion.net` variant timed out / was unreachable from the Replit dev sandbox network. Always strip a leading `www.` before calling MoneyFusion, or test both if reachability issues appear.
- The payment status verification endpoint is **not** `{apiUrl}{token}` as the docs summary implied — the real working endpoint is `{origin}/paiementNotif/{token}` (GET), returning `{statut: true, data: {statut: "pending"|"paid"|..., ...}}`.
- **Why:** trusting a docs paraphrase without probing led to a 404 in production-like testing; curl-testing the exact live endpoint before wiring it into `verifyPayment()` caught this.
- **How to apply:** for any external payment/API integration where docs may be stale or ambiguous, do a live curl probe of both the create and the verify/status endpoints before finalizing the service code — don't just trust a written spec.
- Also add an explicit fetch timeout (e.g. `AbortSignal.timeout(15000)`) on any outbound call to this API — it can hang without one, blocking the request indefinitely.
