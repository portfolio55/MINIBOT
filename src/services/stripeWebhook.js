/**
 * Traitement du webhook Stripe — vérifie la signature via StripeSync puis
 * synchronise les données (customers/subscriptions/invoices) en base.
 */
import { getStripeSync } from "../stripeClient.js";
import { dbLinkStripeSubscription, dbGetBotByStripeCustomerId, dbExtendSubscription } from "../db.js";
import { SUBSCRIPTION_PLANS, STRIPE_PRICE_TO_PLAN } from "../config.js";
import logger from "../utils/logger.js";

export async function processStripeWebhook(payload, signature) {
  if (!Buffer.isBuffer(payload)) {
    throw new Error(
      "STRIPE WEBHOOK ERROR: le payload doit être un Buffer. " +
      "Type reçu: " + typeof payload + ". " +
      "Cela signifie généralement qu'express.json() a analysé le body avant d'atteindre ce handler. " +
      "CORRECTION: la route webhook doit être enregistrée AVANT app.use(express.json())."
    );
  }

  const sync = await getStripeSync();
  const event = await sync.processWebhook(payload, signature);

  // Après synchro dans le schéma stripe.*, on active/prolonge l'abonnement
  // côté application via la même logique que MoneyFusion (dbExtendSubscription).
  try {
    await activateSubscriptionFromEvent(event);
  } catch (err) {
    logger.error(`[Stripe] Erreur activation abonnement après webhook: ${err.message}`);
  }

  return event;
}

async function activateSubscriptionFromEvent(event) {
  if (!event || !event.type) return;

  const relevantTypes = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "invoice.paid",
  ];
  if (!relevantTypes.includes(event.type)) return;

  const obj = event.data?.object;
  if (!obj) return;

  let customerId = obj.customer;
  let priceId = null;
  let subscriptionId = null;

  if (event.type === "checkout.session.completed") {
    subscriptionId = obj.subscription || null;
    customerId = obj.customer;
  } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    subscriptionId = obj.id;
    priceId = obj.items?.data?.[0]?.price?.id || null;
    if (obj.status !== "active" && obj.status !== "trialing") return; // n'active que si payé/actif
  } else if (event.type === "invoice.paid") {
    subscriptionId = obj.subscription || null;
    priceId = obj.lines?.data?.[0]?.price?.id || null;
  }

  if (!customerId) return;

  const bot = await dbGetBotByStripeCustomerId(customerId);
  if (!bot) {
    logger.warn(`[Stripe] Webhook ${event.type}: aucun bot lié au customer ${customerId}`);
    return;
  }

  if (subscriptionId) {
    await dbLinkStripeSubscription(bot.uuid, customerId, subscriptionId);
  }

  const plan = priceId ? STRIPE_PRICE_TO_PLAN[priceId] : bot.pendingStripePlan;
  const planDef = plan ? SUBSCRIPTION_PLANS[plan] : null;
  if (!planDef) {
    logger.warn(`[Stripe] Webhook ${event.type}: plan introuvable pour price ${priceId} (bot ${bot.uuid})`);
    return;
  }

  await dbExtendSubscription(bot.uuid, plan, planDef.durationMs);
  logger.info(`[Stripe] Abonnement ${plan} activé/prolongé pour bot ${bot.uuid} via Stripe (${event.type})`);
}
