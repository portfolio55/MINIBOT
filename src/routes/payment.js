/**
 * Routes de paiement MoneyFusion — création de commande + webhook de confirmation
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createPayment, verifyPayment } from "../services/moneyfusion.js";
import { dbCreatePayment, dbGetPaymentByToken, dbConfirmPayment, dbExtendSubscription, dbGetBotAccount } from "../db.js";
import { SUBSCRIPTION_PLANS } from "../config.js";
import { requireUserAuth } from "./auth.js";
import logger from "../utils/logger.js";

const router = Router();

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de demandes de paiement. Réessayez dans une minute." },
});

function getPublicUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
}

// Crée une demande de paiement pour un plan donné (utilisateur connecté uniquement)
router.post("/api/payment/create", paymentLimiter, requireUserAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const planDef = SUBSCRIPTION_PLANS[plan];
    if (!planDef || plan === "trial") {
      return res.status(400).json({ error: "Plan invalide" });
    }

    const bot = await dbGetBotAccount(req.user.uuid);
    if (!bot) return res.status(404).json({ error: "Compte introuvable" });

    const baseUrl = getPublicUrl(req);
    const result = await createPayment({
      amount: planDef.price,
      label: `Abonnement ${planDef.label} - SIGMA MDX`,
      clientName: bot.username || bot.phoneNumber,
      clientNumber: bot.phoneNumber,
      uuid: bot.uuid,
      plan,
      returnUrl: `${baseUrl}/api/payment/return`,
      webhookUrl: `${baseUrl}/api/payment/webhook`,
    });

    if (!result.ok) {
      return res.status(502).json({ error: result.error || "Échec de la création du paiement" });
    }

    await dbCreatePayment(bot.uuid, plan, planDef.price, result.token);
    res.json({ ok: true, url: result.url, token: result.token });
  } catch (err) {
    logger.error(`[Payment] Erreur /api/payment/create: ${err.message}`);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

async function processConfirmedPayment(mfToken) {
  const payment = await dbGetPaymentByToken(mfToken);
  if (!payment) {
    logger.warn(`[Payment] Webhook reçu pour token inconnu: ${mfToken}`);
    return { ok: false };
  }
  if (payment.status === "paid") {
    return { ok: true, alreadyProcessed: true };
  }

  // [SÉCURITÉ] Ne jamais faire confiance au seul payload du webhook — revérifier le statut
  // directement auprès de MoneyFusion avant de créditer l'abonnement (anti-spoofing).
  const verification = await verifyPayment(mfToken);
  if (!verification.ok || !verification.paid) {
    logger.warn(`[Payment] Vérification échouée pour ${mfToken}: ${verification.error || "non payé"}`);
    return { ok: false };
  }

  const planDef = SUBSCRIPTION_PLANS[payment.plan];
  if (!planDef) {
    logger.error(`[Payment] Plan inconnu pour paiement ${mfToken}: ${payment.plan}`);
    return { ok: false };
  }

  const confirmed = await dbConfirmPayment(mfToken);
  if (!confirmed) return { ok: true, alreadyProcessed: true };

  await dbExtendSubscription(payment.uuid, payment.plan, planDef.durationMs);
  logger.info(`[Payment] Abonnement ${payment.plan} activé pour bot ${payment.uuid} (token ${mfToken})`);
  return { ok: true };
}

// Webhook MoneyFusion — notification serveur-à-serveur
router.post("/api/payment/webhook", async (req, res) => {
  try {
    const { tokenPay } = req.body || {};
    if (!tokenPay) return res.status(400).json({ error: "tokenPay manquant" });

    await processConfirmedPayment(tokenPay);
    res.sendStatus(200);
  } catch (err) {
    logger.error(`[Payment] Erreur webhook: ${err.message}`);
    res.sendStatus(200); // Toujours 200 pour éviter les retries agressifs de MoneyFusion
  }
});

// Retour du client après paiement (redirection navigateur)
router.get("/api/payment/return", async (req, res) => {
  try {
    const token = req.query.token;
    if (token) {
      await processConfirmedPayment(token);
    }
  } catch (err) {
    logger.error(`[Payment] Erreur return: ${err.message}`);
  }
  res.redirect("/account.html?payment=processed");
});

export default router;
