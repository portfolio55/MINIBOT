/**
 * Routes de paiement Stripe — abonnement récurrent par carte bancaire,
 * moyen de paiement additionnel à MoneyFusion (même logique d'activation).
 */
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { getUncachableStripeClient } from "../stripeClient.js";
import { processStripeWebhook } from "../services/stripeWebhook.js";
import { dbGetBotAccount, dbSetStripeCustomerId } from "../db.js";
import { SUBSCRIPTION_PLANS, STRIPE_PRICE_TO_PLAN } from "../config.js";
import { requireUserAuth } from "./auth.js";
import logger from "../utils/logger.js";

const router = Router();

const stripeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes de paiement. Réessayez dans une minute." },
});

function getPublicUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
}

// Route webhook — DOIT être montée AVANT express.json() dans server.js (body brut requis)
export function mountStripeWebhook(app) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Signature stripe-signature manquante" });
      }
      try {
        await processStripeWebhook(req.body, signature);
        res.status(200).json({ received: true });
      } catch (err) {
        logger.error(`[Stripe] Erreur webhook: ${err.message}`);
        res.status(400).json({ error: "Erreur de traitement du webhook" });
      }
    }
  );
}

// Liste les plans disponibles avec leur price_id Stripe (pour affichage front-end)
router.get("/api/stripe/plans", (req, res) => {
  const plans = Object.entries(SUBSCRIPTION_PLANS)
    .filter(([key]) => key !== "trial")
    .map(([key, def]) => {
      const priceId = Object.keys(STRIPE_PRICE_TO_PLAN).find((p) => STRIPE_PRICE_TO_PLAN[p] === key);
      return { plan: key, label: def.label, priceId: priceId || null };
    })
    .filter((p) => p.priceId);
  res.json({ plans });
});

// Crée une session Stripe Checkout (mode abonnement) pour le plan demandé
router.post("/api/stripe/checkout", stripeLimiter, requireUserAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const planDef = SUBSCRIPTION_PLANS[plan];
    if (!planDef || plan === "trial") {
      return res.status(400).json({ error: "Plan invalide" });
    }

    const priceId = Object.keys(STRIPE_PRICE_TO_PLAN).find((p) => STRIPE_PRICE_TO_PLAN[p] === plan);
    if (!priceId) {
      return res.status(400).json({ error: "Ce plan n'est pas disponible via paiement par carte pour le moment" });
    }

    const bot = await dbGetBotAccount(req.user.uuid);
    if (!bot) return res.status(404).json({ error: "Compte introuvable" });

    const stripe = await getUncachableStripeClient();
    const baseUrl = getPublicUrl(req);

    const sessionParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/account.html?stripe=success`,
      cancel_url: `${baseUrl}/account.html?stripe=cancelled`,
      client_reference_id: bot.uuid,
      metadata: { uuid: bot.uuid, plan },
      subscription_data: { metadata: { uuid: bot.uuid, plan } },
    };

    if (bot.stripeCustomerId) {
      sessionParams.customer = bot.stripeCustomerId;
    }
    // Sinon, pas de customer/email connu — Stripe Checkout en demandera un lui-même.

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (session.customer && !bot.stripeCustomerId) {
      await dbSetStripeCustomerId(bot.uuid, session.customer);
    }

    res.json({ ok: true, url: session.url });
  } catch (err) {
    logger.error(`[Stripe] Erreur /api/stripe/checkout: ${err.message}`);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
