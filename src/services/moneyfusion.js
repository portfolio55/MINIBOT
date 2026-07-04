/**
 * Service d'intégration MoneyFusion (FusionPay)
 * Documentation: https://docs.moneyfusion.net/en/
 */
import crypto from "crypto";
import config from "../config.js";
import logger from "../utils/logger.js";

/**
 * Normalise l'URL de l'API MoneyFusion : le sous-domaine "www.pay.moneyfusion.net"
 * s'est révélé injoignable (timeout réseau) alors que "pay.moneyfusion.net" (sans www)
 * répond correctement — on retire donc le préfixe "www." s'il est présent.
 */
function normalizeApiUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Initie un paiement MoneyFusion
 * @param {object} params
 * @param {number} params.amount - Montant total (FCFA)
 * @param {string} params.label - Libellé de l'article (nom du plan)
 * @param {string} params.clientName - Nom du client
 * @param {string} params.clientNumber - Numéro de téléphone du client
 * @param {string} params.uuid - UUID du bot (pour retrouver la commande au webhook)
 * @param {string} params.plan - Clé du plan d'abonnement
 * @param {string} params.returnUrl - URL de retour après paiement
 * @param {string} params.webhookUrl - URL de notification webhook
 * @returns {Promise<{ok: boolean, token?: string, url?: string, error?: string}>}
 */
export async function createPayment({ amount, label, clientName, clientNumber, uuid, plan, returnUrl, webhookUrl }) {
  const apiUrl = normalizeApiUrl(config.moneyfusion.apiUrl);
  if (!apiUrl) {
    return { ok: false, error: "MONEYFUSION_API_URL non configuré" };
  }

  try {
    const body = {
      totalPrice: amount,
      article: [{ nom: label, montant: amount }],
      nomclient: clientName || "Client SIGMA MDX",
      numeroSend: clientNumber,
      personal_Info: [{ userId: uuid, orderId: `${uuid}-${plan}-${Date.now()}` }],
      return_url: returnUrl,
      webhook_url: webhookUrl,
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (!res.ok || !data.statut) {
      logger.warn(`[MoneyFusion] Échec création paiement: ${JSON.stringify(data)}`);
      return { ok: false, error: data.message || "Erreur MoneyFusion" };
    }

    return { ok: true, token: data.token, url: data.url };
  } catch (err) {
    logger.error(`[MoneyFusion] Erreur createPayment: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Vérifie le statut réel d'un paiement côté serveur MoneyFusion
 * (Ne JAMAIS créditer un abonnement uniquement sur la foi du webhook — toujours revérifier ici)
 * @param {string} token - Token de paiement MoneyFusion
 * @returns {Promise<{ok: boolean, paid?: boolean, data?: object, error?: string}>}
 */
export async function verifyPayment(token) {
  const apiUrl = normalizeApiUrl(config.moneyfusion.apiUrl);
  if (!apiUrl || !token) return { ok: false, error: "Paramètres manquants" };

  try {
    // Endpoint officiel de vérification MoneyFusion: {origin}/paiementNotif/{token}
    // (documenté sur docs.moneyfusion.net/en/webapi — distinct de l'URL de création de paiement)
    const origin = new URL(apiUrl).origin;
    const verifyUrl = `${origin}/paiementNotif/${token}`;

    const res = await fetch(verifyUrl, { method: "GET", signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    if (!res.ok || !data.statut) {
      return { ok: false, error: data.message || "Vérification échouée" };
    }

    const paid = data.data?.statut === "paid";
    return { ok: true, paid, data: data.data };
  } catch (err) {
    logger.error(`[MoneyFusion] Erreur verifyPayment: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

export function generateCredentials(phoneNumber) {
  const digits = String(phoneNumber).replace(/\D/g, "").slice(-8);
  const username = `sigma${digits}${crypto.randomInt(10, 99)}`;
  const password = crypto.randomBytes(4).toString("hex");
  return { username, password };
}
